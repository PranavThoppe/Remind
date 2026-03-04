import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
    BedrockRuntimeClient,
    ConverseCommand,
} from "npm:@aws-sdk/client-bedrock-runtime@3.705.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID')
        const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY')
        const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1'

        if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
            return new Response(JSON.stringify({ error: 'AWS credentials not configured' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let body: any
        try {
            body = await req.json()
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const { reminder, client_date } = body

        if (!reminder || !reminder.id) {
            return new Response(JSON.stringify({ error: 'A reminder object is required for nova-suggest' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── Date context ──────────────────────────────────────────────────
        let now: Date
        let todayStr: string

        if (client_date) {
            todayStr = client_date
            now = new Date(client_date + 'T12:00:00Z')
        } else {
            now = new Date()
            todayStr = now.toISOString().split('T')[0]
        }

        const fullToday = `${now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}, ${now.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })} ${now.getUTCDate()}, ${now.getUTCFullYear()} (${todayStr})`

        // ── Pinned reminder summary for system prompt ─────────────────────
        const reminderSummary = [
            `Title: ${reminder.title || 'Unknown'}`,
            reminder.date ? `Date: ${reminder.date}` : `Date: Not set`,
            reminder.time ? `Time: ${reminder.time}` : `Time: Not set`,
            reminder.repeat && reminder.repeat !== 'none' ? `Repeats: ${reminder.repeat}` : `Repeats: none`,
            reminder.notes ? `Notes: ${reminder.notes}` : null,
        ].filter(Boolean).join('\n')

        // ── Bedrock client ──────────────────────────────────────────────
        const client = new BedrockRuntimeClient({
            region: AWS_REGION,
            credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY }
        })

        // ── Constraint Satisfaction (Forward Checking) ──────────────────────
        const allCapabilities = [
            {
                id: "time",
                condition: (r: any) => !r.time, // Only suggest time if none exists
                text: "- Setting a specific time (e.g., \"Set time for 5 PM\", \"Remind me tomorrow morning\")"
            },
            {
                id: "date",
                condition: (r: any) => !r.date, // Only suggest date if none exists
                text: "- Adding a specific date or deadline (e.g., \"Schedule for next Friday\")"
            },
            {
                id: "repeat",
                condition: (r: any) => !r.repeat || r.repeat === 'none', // Only if not already repeating
                text: "- Setting complex repeating schedules (e.g., \"Make this repeat on the 1st of every month\", \"Repeat every other Friday\")"
            },
            {
                id: "priority",
                condition: (r: any) => r.priority !== 'high', // Only if not high priority
                text: "- Marking as high priority (e.g., \"Mark as high priority\")"
            },
            {
                id: "checklist",
                condition: () => true, // Always available
                text: "- Creating checklists or subtasks (e.g., \"Create a grocery list\", \"Draft a party checklist\", \"Break down into daily goals\"). STRONGLY consider suggesting this for any task that could even remotely have multiple steps or require planning."
            },
            {
                id: "notifications",
                condition: () => true, // Always available
                text: "- Setting notifications for relative times (MUST use the word \"notify\", e.g., \"Notify me 10 mins before\", \"Notify me when I arrive at the store\")"
            },
            {
                id: "location",
                condition: () => true, // Always available
                text: "- Adding locations (e.g., \"Add location: City Hospital\")"
            },
            {
                id: "link",
                condition: () => true, // Always available
                text: "- Linking URLs or Notes (e.g., \"Add a link to the payment portal\")"
            }
        ];

        // Forward Checking: Filter capabilities based on reminder state
        const validCapabilities = allCapabilities
            .filter(cap => cap.condition(reminder))
            .map(cap => cap.text)
            .join('\n');

        const systemPrompt = `You are an AI assistant module for a reminder app. Your sole purpose is to generate exactly 4 highly contextual, actionable suggestions based on a specific reminder. 

Today is ${fullToday}.

REMINDER CONTEXT:
${reminderSummary}

CAPABILITIES YOU CAN SUGGEST:
${validCapabilities}

RULES:
1. Provide EXACTLY 4 suggestions. No more, no less.
2. The suggestions should be short, punchy, and sound natural. Aim for 3-7 words.
3. Keep them highly contextual to the reminder's title. If the reminder is "Pay utility bill", suggest "Add payment link" or "Repeat monthly".
4. Evaluate the complexity of the task! When in doubt, lean towards suggesting creating a checklist or breaking the task into steps, as we have a powerful UI for subtasks.
5. When referring to alerts or alarms, always use the word "notify" (e.g. "Notify me...", not "Remind me...").
6. OUTPUT FORMAT: You MUST return ONLY a raw JSON array of 4 strings. DO NOT wrap the output in markdown code blocks like \`\`\`json. DO NOT add any conversational text.

EXAMPLE OUTPUT:
[
  "Create a grocery list",
  "Notify me when I arrive",
  "Add a reminder time",
  "Mark as high priority"
]`

        const command = new ConverseCommand({
            modelId: "us.amazon.nova-lite-v1:0",
            system: [{ text: systemPrompt }],
            messages: [{
                role: "user",
                content: [{ text: "Generate 4 contextual suggestions for this reminder." }]
            }]
        })

        let response: any
        try {
            response = await client.send(command)
        } catch (bedrockError: any) {
            console.error('[Nova Suggest Error] Bedrock Error:', bedrockError)
            return new Response(JSON.stringify({
                error: 'Failed to call Amazon Bedrock',
                details: bedrockError.message,
                code: bedrockError.name
            }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const rawText = response.output?.message?.content?.find((c: any) => c.text)?.text || "[]"
        let suggestions: string[] = []

        try {
            // Attempt to parse the raw JSON directly, stripping any potential markdown code blocks just in case
            const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
            suggestions = JSON.parse(cleanJson)

            if (!Array.isArray(suggestions)) {
                suggestions = []
            }
        } catch (e) {
            console.error("[Nova Suggest Error] Failed to parse JSON:", rawText)
        }

        // Ensure exactly 4
        if (suggestions.length !== 4) {
            // Setup dynamic fallback map based on our IDs
            const fallbackMap: Record<string, string> = {
                "time": "Add a reminder time",
                "date": "Add a date",
                "repeat": "Make this repeating",
                "priority": "Mark as high priority",
                "checklist": "Break into steps",
                "notifications": "Add a notification",
                "location": "Add location",
                "link": "Add a note"
            };

            // Derive valid defaults using the same constraints from earlier
            const validIds = allCapabilities.filter(c => c.condition(reminder)).map(c => c.id);
            const defaultSuggestions = validIds.map(id => fallbackMap[id]).filter(Boolean);

            if (suggestions.length < 4) {
                // If we ran out of LLM suggestions, pad with safe defaults
                // Avoid duplicates between LLM output and our defaults
                const remainingDefaults = defaultSuggestions.filter(d => !suggestions.includes(d as string));
                suggestions = [...suggestions, ...(remainingDefaults as string[])].slice(0, 4);
            } else if (suggestions.length > 4) {
                // Too many suggestions, slice down to 4
                suggestions = suggestions.slice(0, 4);
            }

            // Extreme fallback if filtering somehow left us with < 4 suggestions
            if (suggestions.length < 4) {
                const extremeDefaults = ["Edit reminder", "Add details", "Change tag", "Add subtask"];
                const padding = extremeDefaults.filter(d => !suggestions.includes(d));
                suggestions = [...suggestions, ...padding].slice(0, 4);
            }
        }

        return new Response(JSON.stringify({ suggestions }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[Nova Suggest Error]', error)
        return new Response(JSON.stringify({ error: error.message, details: error.stack }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
