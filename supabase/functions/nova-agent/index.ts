import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    BedrockRuntimeClient,
    ConverseCommand,
} from "npm:@aws-sdk/client-bedrock-runtime@3.705.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
}

// ============================================================
// TOOL DEFINITIONS
// ============================================================


// (comment_on_day tool removed)

const draftReminderTool = {
    name: "draft_reminder",
    description: "Proposes a reminder to the user for review before saving. Use this BY DEFAULT whenever the user wants to create a reminder. The user can review and edit details before confirming.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Brief reminder title (max 6 words)."
                },
                date: {
                    type: "string",
                    description: "Date in YYYY-MM-DD format."
                },
                time: {
                    type: "string",
                    description: "Time in HH:mm 24-hour format. Only include if user specifies a time. Omit if no specific time is provided."
                },
                repeat: {
                    type: "string",
                    description: "Recurrence pattern using RFC 5545 RRULE or 'none'."
                },
                repeat_until: {
                    type: "string",
                    description: "End date for recurring reminders in YYYY-MM-DD format. Only set for time-limited repeats (e.g., 'every Monday for 2 months'). Omit for indefinite."
                },
                tag_name: {
                    type: "string",
                    description: "Name of the tag/category to assign. Must match one of the user's available tags."
                },
                priority_name: {
                    type: "string",
                    description: "Name of the priority level to assign. Must match one of the user's available priorities."
                },
                notes: {
                    type: "string",
                    description: "Contextual notes or details about the reminder derived from the conversation."
                },
                subtasks: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: "List of subtasks if the user asks to break down the task or asks for a checklist. Only include if explicitly requested or implied (e.g. 'pack for my trip with a checklist')."
                },
                notification_offsets: {
                    type: "array",
                    items: { type: "number" },
                    description: "Minutes before the reminder time to send a notification (e.g., [15] = 15 mins before, [60] = 1 hour before, [1440] = 1 day before). Only include if the user explicitly asks to be alerted."
                }
            },
            required: ["title", "date"]
        }
    }
}

// ============================================================
// HELPERS
// ============================================================

function formatTime(timeStr: string | null, format: '12h' | '24h' = '12h') {
    if (!timeStr) return 'Anytime';
    if (format === '24h') return timeStr;

    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// ============================================================
// TOOL HANDLERS
// ============================================================


async function handleDraftReminder(toolInput: any, userId: string, supabase: any) {
    console.log('[Agent] draft_reminder:', JSON.stringify(toolInput, null, 2))

    // Map string subtasks to Subtask objects for the UI
    let formattedSubtasks = [];
    if (toolInput.subtasks && Array.isArray(toolInput.subtasks)) {
        formattedSubtasks = toolInput.subtasks.map((title: string, index: number) => ({
            id: `temp-subtask-${Date.now()}-${index}`,
            reminder_id: 'draft',
            title: title,
            is_completed: false,
            position: index
        }));
    }

    return {
        success: true,
        draft: {
            ...toolInput,
            subtasks: formattedSubtasks.length > 0 ? formattedSubtasks : undefined,
            is_draft: true
        },
        message: "I've drafted a reminder for you. Please review it above."
    }
}

// (handleCommentOnDay removed)

// ============================================================
// MAIN SERVER
// ============================================================

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID')
        const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY')
        const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1'
        const ADMIN_SECRET_KEY = Deno.env.get('ADMIN_SECRET_KEY')!

        // Validate AWS credentials
        if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
            console.error('[Nova Agent] Missing AWS credentials!')
            return new Response(JSON.stringify({
                error: 'AWS credentials not configured',
                details: 'Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Supabase Edge Function secrets'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Parse request body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const { query, user_id: body_user_id, client_date, conversation } = body

        if (!query) {
            return new Response(JSON.stringify({ error: 'Query required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ============================================================
        // SUPABASE CLIENT & AUTHENTICATION
        // ============================================================
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        let userId: string
        let supabaseClient: any

        const adminSecret = req.headers.get('x-admin-secret')
        if (adminSecret && adminSecret === ADMIN_SECRET_KEY && body_user_id) {
            console.log('[Nova Agent] Admin Bypass - Using user:', body_user_id)
            userId = body_user_id
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        } else {
            const authHeader = req.headers.get('Authorization')
            if (!authHeader) {
                return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: authHeader } }
            })

            const { data: { user: authUser }, error: userError } = await supabaseClient.auth.getUser()
            if (userError || !authUser) {
                return new Response(JSON.stringify({ error: 'Unauthorized: Invalid JWT' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            userId = authUser.id
        }

        console.log('[Nova Agent] User:', userId, 'Query:', query, 'Client Date:', client_date)

        // ============================================================
        // FETCH USER'S TAGS, PRIORITIES & COMMON TIMES
        // ============================================================

        const [tagsRes, prioritiesRes, commonTimesRes, contextRes] = await Promise.all([
            supabaseClient.from('tags').select('id, name, color, description').eq('user_id', userId).order('name'),
            supabaseClient.from('priorities').select('id, name, color, rank').eq('user_id', userId).order('rank'),
            supabaseClient.from('common_times').select('morning, afternoon, evening, night').eq('user_id', userId).maybeSingle(),
            supabaseClient.from('user_context').select('key, value').eq('user_id', userId).eq('key', 'time_format').limit(1)
        ])

        const userTags = tagsRes.data || []
        const userPriorities = prioritiesRes.data || []
        const commonTimes = commonTimesRes.data || { morning: '09:00', afternoon: '14:00', evening: '18:00', night: '21:00' }
        const contextItems = contextRes.data || []

        const tagsContext = userTags.length > 0
            ? `Available tags:\n${userTags.map((t: any) => `- ${t.name}${t.description ? ` (${t.description})` : ''}`).join('\n')}`
            : 'No tags configured.'

        const prioritiesContext = userPriorities.length > 0
            ? `Available priorities: ${userPriorities.map((p: any) => p.name).join(', ')}`
            : 'No priorities configured.'

        const commonTimesContext = `Common Times:
- Morning: ${commonTimes.morning}
- Afternoon: ${commonTimes.afternoon}
- Evening: ${commonTimes.evening}
- Night: ${commonTimes.night}`

        const timeFormatItem = contextItems.find((c: any) => c.key === 'time_format');
        const time_format = timeFormatItem ? timeFormatItem.value : '12h';

        console.log('[Nova Agent] Tags:', userTags.length, 'Priorities:', userPriorities.length)

        // ============================================================
        // DATE CONTEXT
        // ============================================================

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

        const tomorrow = new Date(now)
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        const next7Days: string[] = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(now)
            d.setUTCDate(d.getUTCDate() + i)
            const dateStr = d.toISOString().split('T')[0]
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
            const label = i === 0 ? " (Today)" : i === 1 ? " (Tomorrow)" : ""
            next7Days.push(`${dayName}${label}: ${dateStr}`)
        }
        const next7DaysContext = `Upcoming Dates (Next 7 Days):\n${next7Days.join('\n')}`

        // ============================================================
        // BEDROCK CLIENT & TOOLS
        // ============================================================

        const client = new BedrockRuntimeClient({
            region: AWS_REGION,
            credentials: {
                accessKeyId: AWS_ACCESS_KEY_ID,
                secretAccessKey: AWS_SECRET_ACCESS_KEY,
            },
        })

        const tools = [
            { toolSpec: draftReminderTool },
        ]

        const systemPrompt = `You are Nova, a friendly and focused reminder creation assistant. Your ONLY job is to help the user create new reminders. If a user is talking to you, assume with 100% certainty that they want to create or refine a reminder. Today is ${fullToday}.

${next7DaysContext}

${tagsContext}
${prioritiesContext}
${commonTimesContext}

## The "Reminder-First" Mindset

1. **Assume Intent**: Every message from the user is an attempt to create a reminder. Never ask "How can I help you?" or "Would you like to create a reminder?". Instead, do your best to figure out WHAT they want to be reminded of and WHEN.
2. **Subject Neutrality**: Treat all topics as valid reminder titles. Whether it's "Check ChatGPT subscription", "Laundry", "Buy milk", or "Meeting with CEO", your job is simply to record it. Never refuse a request based on the subject matter.
3. **Proactive Drafting**: If the user provides even a partial task (e.g., just "Netflix" or just "Tomorrow"), IMMEDIATELY call draft_reminder. It is better to show a draft review card with missing info than to ask a follow-up question. The user can then tap fields in the UI to fill them in.
4. **Contextual Intelligence**: Always look at the conversation history. If a user says "Tomorrow" as a follow-up to "Remind me to check the mail", immediately call draft_reminder with the title "Check the mail" and the date for tomorrow.

## How to Create/Update Drafts

- **Continuous Iteration**: The drafting process is iterative. The user will keep sending messages to refine or correct the reminder (e.g., "add a tag", "change the time", "actually make it for Monday"). Treat every message AS a refinement request for the current draft.
- **Primary Interface**: The \`draft_reminder\` tool IS your primary way to "speak" to the user. Instead of explaining what you are doing, just call the tool with the updated state. The user sees the draft card as your response.
- **Redrafting Corrections**: If the user asks to change a field, call \`draft_reminder\` again with ALL the corrected fields. Use the \`[CURRENT DRAFT STATE]\` block from history as your absolute base. **CRITICAL**: Always copy the title, date, tag, and all other fields from the current state unless the user explicitly asks to change them.
- **Keep Drafting**: Keep calling \`draft_reminder\` for every message until the user specifically says "Reminder confirmed:".

## Reminder Fields

**Title:** Concise, max 6 words. If the user's intent is unclear, use their exact phrasing as the title.
**Date:** Calculate YYYY-MM-DD. Use the Upcoming Dates list.
- If no date is mentioned, use Today (${todayStr}) as a placeholder rather than asking for one.
**Time:** Use HH:mm 24-hour format. Use Common Times (morning, etc.) if specified.
**Repeat:** Use RFC 5545 RRULE.
**Subtasks:** Include if the user asks for a checklist or mentions multiple steps.
**Notes:** Capture extra context here.

## Forbidden Behavior

- DO NOT say "I cannot assist with...", "I don't have access to...", or "I'm just a reminder assistant".
- DO NOT say "I've updated the draft" or "Here is the new draft" with text. The tool call itself is the update.
- **CRITICAL**: DO NOT output any text when you call a tool. Your response should contain ONLY the tool call. No confirmation, no friendly message, no text at all. Stop immediately after the tool call.
- **Confirmation Handling**: If the user's message starts with "Reminder confirmed:", it means they just saved a draft you provided. Respond with "Done!" and DO NOT call ANY tools.
- Never wrap responses in XML tags like <thinking> or <response>.

## Rules

- After calling draft_reminder, you MUST NOT provide any text output.
- The user's preferred time format is ${time_format}. Use this when speaking (if ever needed), but ALWAYS use 24h format for tool calls.`

        // ============================================================
        // BUILD CONVERSATION
        // ============================================================

        let conversationMessages: any[] = []

        if (Array.isArray(conversation) && conversation.length > 0) {
            conversationMessages = conversation.map((msg: any) => {
                let text = msg.content;

                // If this was a draft proposal, append the draft data to the text
                // so the agent "sees" what it previously proposed even if it's not in DB yet.
                if (msg.role === 'assistant' && msg.panelType === 'draft' && msg.panelFields) {
                    const fields = msg.panelFields;

                    // Map IDs back to names for the LLM context
                    const tagName = fields.tag_id ? userTags.find((t: any) => t.id === fields.tag_id)?.name : fields.tag_name;
                    const priorityName = fields.priority_id ? userPriorities.find((p: any) => p.id === fields.priority_id)?.name : fields.priority_name;

                    const draftContext = [
                        `\n### [CURRENT DRAFT STATE]`,
                        `* **Title**: ${fields.title || 'None'}`,
                        `* **Date**: ${fields.date || 'None'}`,
                        fields.time ? `* **Time**: ${fields.time}` : null,
                        tagName ? `* **Tag**: ${tagName}` : null,
                        priorityName ? `* **Priority**: ${priorityName}` : null,
                        fields.notes ? `* **Notes**: ${fields.notes}` : null,
                        fields.subtasks && fields.subtasks.length > 0
                            ? `* **Subtasks**: ${fields.subtasks.map((s: any) => s.title || s).join(', ')}`
                            : null,
                    ].filter(Boolean).join('\n');
                    text += `\n${draftContext}\n`;
                }

                return {
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: [{ text: text }]
                };
            })

            // Bedrock: conversation must start with a user message
            while (conversationMessages.length > 0 && conversationMessages[0].role !== 'user') {
                console.log('[Nova Agent] Dropping leading assistant message')
                conversationMessages.shift()
            }
        }

        const currentQueryMessage = {
            role: "user",
            content: [{ text: query }]
        }

        if (conversationMessages.length > 0 && conversationMessages[conversationMessages.length - 1].role === 'user') {
            console.log('[Nova Agent] Merging consecutive user messages')
            const lastMsg = conversationMessages[conversationMessages.length - 1]
            lastMsg.content[0].text = `${lastMsg.content[0].text}\n\n${query}`
        } else {
            conversationMessages.push(currentQueryMessage)
        }

        // ============================================================
        // AGENTIC LOOP
        // ============================================================

        let iterationCount = 0
        const maxIterations = 5
        const toolCallLog: any[] = []

        console.log('[Nova Agent] Starting conversation loop...')

        while (iterationCount < maxIterations) {
            iterationCount++

            const command = new ConverseCommand({
                modelId: "us.amazon.nova-lite-v1:0",
                system: [{ text: systemPrompt }],
                messages: conversationMessages,
                toolConfig: { tools }
            })

            let response;
            try {
                response = await client.send(command)
            } catch (bedrockError: any) {
                console.error('[Nova Agent] Bedrock Converse Error:', bedrockError)
                return new Response(JSON.stringify({
                    error: 'Failed to call Amazon Bedrock Converse API',
                    details: bedrockError.message,
                    code: bedrockError.name,
                    hint: bedrockError.name === 'AccessDeniedException'
                        ? 'Check that your AWS credentials have AmazonBedrockFullAccess policy'
                        : 'Verify AWS credentials and model access'
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const stopReason = response.stopReason
            console.log(`[Iteration ${iterationCount}] Stop Reason: ${stopReason}`)

            if (stopReason === "tool_use") {
                const assistantMessage = response.output?.message
                if (!assistantMessage) {
                    throw new Error('No assistant message in tool_use response')
                }

                conversationMessages.push(assistantMessage)

                const toolUseBlocks = assistantMessage.content?.filter((c: any) => c.toolUse) || []
                const toolResultContents: any[] = []

                for (const toolUseBlock of toolUseBlocks) {
                    const toolName = toolUseBlock.toolUse.name
                    const toolInput = toolUseBlock.toolUse.input
                    const toolUseId = toolUseBlock.toolUse.toolUseId

                    console.log(`[Tool Call] ${toolName}`)
                    console.log('[Tool Input]', JSON.stringify(toolInput, null, 2))

                    let toolResult: any
                    if (toolName === "draft_reminder") {
                        toolResult = await handleDraftReminder(toolInput, userId, supabaseClient)
                        // (comment_on_day handling removed)
                    } else {
                        toolResult = { error: `Unknown tool: ${toolName}` }
                    }

                    toolCallLog.push({
                        tool: toolName,
                        input: toolInput,
                        result: toolResult,
                        iteration: iterationCount
                    })

                    toolResultContents.push({
                        toolResult: {
                            toolUseId: toolUseId,
                            content: [{ json: toolResult }]
                        }
                    })
                }

                conversationMessages.push({
                    role: "user",
                    content: toolResultContents
                })

            } else if (stopReason === "end_turn") {
                const rawText = response.output?.message?.content?.find((c: any) => c.text)?.text
                    || "Done!"

                const finalText = rawText
                    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '')
                    .replace(/<response>([\s\S]*?)<\/response>/g, '$1')
                    .trim() || "Done!"

                console.log('[Nova Agent] Final response:', finalText)
                console.log('[Nova Agent] Tool calls made:', toolCallLog.length)

                return new Response(JSON.stringify({
                    message: finalText,
                    tool_calls: toolCallLog,
                    iterations: iterationCount,
                    query: query
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } else {
                console.warn('[Nova Agent] Unexpected stop reason:', stopReason)
                const text = response.output?.message?.content?.find((c: any) => c.text)?.text
                    || "Something unexpected happened."

                return new Response(JSON.stringify({
                    message: text,
                    tool_calls: toolCallLog,
                    iterations: iterationCount,
                    stopReason: stopReason
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // Max iterations hit
        console.warn('[Nova Agent] Max iterations reached!')
        return new Response(JSON.stringify({
            error: 'Max tool-calling iterations reached',
            tool_calls: toolCallLog,
            iterations: iterationCount
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[Nova Agent Error]', error)
        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error',
                details: error.stack
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
