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

const createReminderTool = {
    name: "create_reminder",
    description: "Creates a new reminder immediately WITHOUT asking for review. ONLY use this when the user explicitly says 'create immediately', 'book it now', 'do it now', 'confirm', or similar bypass phrases. In all other cases, use draft_reminder.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Brief reminder title (max 6 words). Extract the main task from the user's request."
                },
                date: {
                    type: "string",
                    description: "Date in YYYY-MM-DD format. Calculate the actual date from relative references like 'tomorrow', 'next Friday', etc."
                },
                time: {
                    type: "string",
                    description: "Time in HH:mm 24-hour format (e.g., '14:30' for 2:30pm). Only include if user specifies a time."
                },
                repeat: {
                    type: "string",
                    description: "Recurrence pattern using RFC 5545 RRULE (e.g., 'FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,WE'). Default is 'none'."
                },
                repeat_until: {
                    type: "string",
                    description: "End date for recurring reminders in YYYY-MM-DD format. Only set when user specifies a time-limited repeat (e.g., 'every Monday for 2 months'). Omit for indefinite repeats."
                },
                tag_name: {
                    type: "string",
                    description: "Name of the tag/category to assign. Must match one of the user's available tags. Only include if the user mentions a category."
                },
                priority_name: {
                    type: "string",
                    description: "Name of the priority level to assign. Must match one of the user's available priorities. Only include if the user mentions a priority."
                },
                notes: {
                    type: "string",
                    description: "Contextual notes or details about the reminder."
                },
                subtasks: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: "List of subtasks if the user asks to break down the task or asks for a checklist."
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
// TOOL HANDLERS
// ============================================================

async function handleCreateReminder(toolInput: any, userId: string, supabase: any) {
    console.log('[DB] create_reminder:', JSON.stringify(toolInput, null, 2))

    // Resolve tag_name to tag_id if provided
    let tagId = null
    if (toolInput.tag_name) {
        const { data: tagData } = await supabase
            .from('tags')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', toolInput.tag_name)
            .limit(1)
            .single()
        tagId = tagData?.id || null
        if (!tagId) console.warn('[DB] Tag not found:', toolInput.tag_name)
    }

    // Resolve priority_name to priority_id if provided
    let priorityId = null
    if (toolInput.priority_name) {
        const { data: priorityData } = await supabase
            .from('priorities')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', toolInput.priority_name)
            .limit(1)
            .single()
        priorityId = priorityData?.id || null
        if (!priorityId) console.warn('[DB] Priority not found:', toolInput.priority_name)
    }

    const { data, error } = await supabase
        .from('reminders')
        .insert({
            user_id: userId,
            title: toolInput.title,
            date: toolInput.date,
            time: toolInput.time || null,
            repeat: toolInput.repeat || 'none',
            repeat_until: toolInput.repeat_until || null,
            tag_id: tagId,
            priority_id: priorityId,
            completed: false,
            notes: toolInput.notes || null
        })
        .select()
        .single()

    if (error) {
        console.error('[DB Error] create_reminder:', error)
        return { success: false, error: error.message }
    }

    // Persist notification offsets if provided
    if (toolInput.notification_offsets && Array.isArray(toolInput.notification_offsets) && toolInput.notification_offsets.length > 0) {
        const { error: offsetError } = await supabase
            .from('reminders')
            .update({ notification_offsets: toolInput.notification_offsets })
            .eq('id', data.id)
        if (offsetError) {
            console.warn('[DB] Could not save notification_offsets:', offsetError)
        }
    }

    // Insert subtasks if provided
    if (toolInput.subtasks && Array.isArray(toolInput.subtasks) && toolInput.subtasks.length > 0) {
        const subtasksToInsert = toolInput.subtasks.map((title: string, index: number) => ({
            reminder_id: data.id,
            title: title,
            is_completed: false,
            position: index
        }));
        const { error: subtaskError } = await supabase
            .from('subtasks')
            .insert(subtasksToInsert);
        if (subtaskError) {
            console.error('[DB Error] create_reminder subtasks:', subtaskError);
        }
    }

    return {
        success: true,
        reminder: {
            id: data.id,
            title: data.title,
            date: data.date,
            time: data.time,
            repeat: data.repeat,
            repeat_until: data.repeat_until || null,
            tag: toolInput.tag_name || null,
            priority: toolInput.priority_name || null,
            notes: data.notes || null
        },
        message: "Reminder created successfully"
    }
}

function handleDraftReminder(toolInput: any) {
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
            { toolSpec: createReminderTool },
        ]

        const systemPrompt = `You are Nova, a friendly and focused reminder creation assistant. Your ONE job is to help the user create new reminders. Today is ${fullToday}.

${next7DaysContext}

${tagsContext}
${prioritiesContext}
${commonTimesContext}

## How to Create Reminders

When the user mentions a task with a date or time, ALWAYS call draft_reminder immediately — do not ask follow-up questions for clear requests. This shows them a preview card they can review before saving.

ONLY use create_reminder if the user explicitly says "create immediately", "book it now", "do it now", or "confirm" — this skips the review step.

## Redrafting Corrections

If the user asks to change a field on a just-drafted reminder (e.g., "actually make it 4pm", "change the day to Friday"), call draft_reminder again with ALL the corrected fields. The previous draft in the conversation is your reference — apply only the changed field and keep everything else the same.

## Reminder Fields

**Title:** Keep it concise, max 6 words. Extract the core task.

**Date:** Calculate the actual YYYY-MM-DD date from relative terms. Use the Upcoming Dates list above.
- If the user specifies a day or month without a year (e.g., "the 15th", "October 4th"), assume the current month and/or year. HOWEVER, if that date has already passed in the current month/year, assume it refers to the NEXT month or year.
- "tomorrow" → ${tomorrowStr}
- "this Monday" or just "Monday" → the nearest upcoming Monday
- "next Monday" → the Monday after the coming one

**Time:** Use HH:mm 24-hour format for tools.
- If the user DOES NOT specify a time (e.g., just says "tomorrow"), DO NOT guess a time. Leave the time field empty/omitted.
- If the user uses time-specific words like "tonight", "morning", "afternoon", "evening", or "night", DO NOT ask follow-up questions. Immediately use the user's Common Times mapping:
- "morning" → ${commonTimes.morning}
- "afternoon" → ${commonTimes.afternoon}
- "evening" / "tonight" → ${commonTimes.evening}
- "night" → ${commonTimes.night}

**Repeat (RRULE examples):**
- Every day: \`FREQ=DAILY\`
- Every weekday: \`FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\`
- Every week: \`FREQ=WEEKLY\`
- Every other week: \`FREQ=WEEKLY;INTERVAL=2\`
- Every Monday and Thursday: \`FREQ=WEEKLY;BYDAY=MO,TH\`
- Monthly on the 1st: \`FREQ=MONTHLY;BYMONTHDAY=1\`
- Monthly on first Monday: \`FREQ=MONTHLY;BYDAY=1MO\`
- Yearly: \`FREQ=YEARLY\`
- No repeat: \`none\` (default)

**repeat_until:** Only set when the user limits the repeat duration (e.g., "every Monday for 2 months" → calculate the end date in YYYY-MM-DD). Leave unset for indefinite repeats.

**notification_offsets:** Array of minutes before reminder time to alert the user. Only set when user explicitly asks:
- "15 minutes before" → [15]
- "1 hour before" → [60]
- "remind me the day before" → [1440]
- "at the time and 30 mins before" → [0, 30]

**Tags:** Only assign a tag if it genuinely fits. Use the exact name from the Available Tags list.

**Subtasks:** Include when user asks to break down a task or requests a checklist (e.g., "pack for my trip with a checklist", "make a plan for my presentation").

**Notes:** Capture supporting context in notes (e.g., "call mom about the party" → title: "Call Mom", notes: "About the party").

## What This Agent Cannot Do

If the user asks to search their existing reminders, update an ALREADY SAVED reminder, or delete a reminder from their database, respond ONLY in plain text — do NOT call any tool. Tell them warmly: "I can only create new reminders here! To update or delete a saved reminder, please tap on it in your reminder list."
(Note: Modifying a DRAFT you just proposed in this chat is perfectly fine—do that by calling draft_reminder again. But modifying a reminder that is already saved is not allowed here.)

## Rules

- CRITICALLY IMPORTANT: After calling draft_reminder or create_reminder, you MUST STOP. Output a short friendly message and wait for the user to respond. Do not call any other tool.
- Do NOT ask follow-up questions for simple, clear requests (e.g., "Remind me to buy milk tomorrow").
- When info is genuinely missing (e.g., no date at all), ask the user to clarify in one friendly sentence.
- If a term is ambiguous (acronym, unusual category), ask what it means before drafting.
- Assign tags only when the reminder clearly fits a tag's description. Never guess.
- TIME FORMAT FOR TEXT: The user's preferred time format is ${time_format}. When speaking, use 12h or 24h accordingly.
- TIME FORMAT FOR TOOLS: Always use HH:mm 24-hour format in tool calls.
- Keep reminder titles under 6 words.
- Be warm and encouraging. Short affirmations ("Sure!", "Got it!", "No problem!") work great for simple requests.
- Never wrap responses in XML tags like <thinking> or <response>.`

        // ============================================================
        // BUILD CONVERSATION
        // ============================================================

        let conversationMessages: any[] = []

        if (Array.isArray(conversation) && conversation.length > 0) {
            conversationMessages = conversation.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: [{ text: msg.content }]
            }))

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
                        toolResult = handleDraftReminder(toolInput)
                    } else if (toolName === "create_reminder") {
                        toolResult = await handleCreateReminder(toolInput, userId, supabaseClient)
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
