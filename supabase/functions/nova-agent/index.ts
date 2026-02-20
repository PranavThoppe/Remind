import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    BedrockRuntimeClient,
    ConverseCommand,
    InvokeModelCommand,
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
    description: "Creates a new reminder in the user's reminder list. Use this when the user wants to add, create, or set a new reminder.",
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
                    enum: ["none", "daily", "weekly", "monthly"],
                    description: "Recurrence pattern. Default is 'none' unless user says 'every day', 'weekly', 'each month', etc."
                },
                tag_name: {
                    type: "string",
                    description: "Name of the tag/category to assign. Must match one of the user's available tags. Only include if the user mentions a category."
                },
                priority_name: {
                    type: "string",
                    description: "Name of the priority level to assign. Must match one of the user's available priorities. Only include if the user mentions a priority."
                },
                repeat_until: {
                    type: "string",
                    description: "End date for recurring reminders in YYYY-MM-DD format. Only set when user specifies a time-limited repeat (e.g., 'every Monday for 2 months'). Leave unset for indefinite repeats."
                },
                notes: {
                    type: "string",
                    description: "Contextual notes or details about the reminder."
                }
            },
            required: ["title", "date"]
        }
    }
}

const draftReminderTool = {
    name: "draft_reminder",
    description: "Proposes a reminder to the user for review. Use this by DEFAULT when the user wants to create a reminder, unless they explicitly say 'create immediately' or 'book it now'. This allows the user to edit details before saving.",
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
                    description: "Time in HH:mm 24-hour format."
                },
                repeat: {
                    type: "string",
                    enum: ["none", "daily", "weekly", "monthly"],
                    description: "Recurrence pattern."
                },
                tag_name: {
                    type: "string",
                    description: "Name of the tag/category to assign."
                },
                priority_name: {
                    type: "string",
                    description: "Name of the priority level to assign."
                },
                notes: {
                    type: "string",
                    description: "Contextual notes or details about the reminder derived from the conversation."
                }
            },
            required: ["title", "date"]
        }
    }
}

const searchRemindersTool = {
    name: "search_reminders",
    description: "Searches for existing reminders. Use this when the user asks questions like 'what do I have tomorrow?', 'show my reminders', 'what's on Friday?', 'do I have anything this week?', or searches for specific reminders by keyword.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Optional keyword to filter reminders by title (e.g., 'doctor', 'gym'). Only set this for keyword searches, NOT for date-based queries."
                },
                start_date: {
                    type: "string",
                    description: "Start of date range in YYYY-MM-DD format (inclusive). For a single day, set start_date and end_date to the same value."
                },
                end_date: {
                    type: "string",
                    description: "End of date range in YYYY-MM-DD format (inclusive). For a single day, set start_date and end_date to the same value."
                }
            },
            required: []
        }
    }
}

const updateReminderTool = {
    name: "update_reminder",
    description: "Updates an existing reminder. Use this when the user wants to change, modify, reschedule, or mark a reminder as complete. Requires a reminder_id from a previous search result.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                reminder_id: {
                    type: "string",
                    description: "ID of the reminder to update. This must come from a previous search result."
                },
                title: {
                    type: "string",
                    description: "New title for the reminder. Only include if user wants to change the title."
                },
                date: {
                    type: "string",
                    description: "New date in YYYY-MM-DD format. Only include if user wants to reschedule."
                },
                time: {
                    type: "string",
                    description: "New time in HH:mm 24-hour format. Only include if user wants to change the time."
                },
                completed: {
                    type: "boolean",
                    description: "Set to true if user wants to mark the reminder as done/complete."
                },
                notes: {
                    type: "string",
                    description: "New notes content. Only include if user wants to add or change notes."
                }
            },
            required: ["reminder_id"]
        }
    }
}

const deleteReminderTool = {
    name: "delete_reminder",
    description: "Deletes an existing reminder. Use this when the user wants to remove, delete, or get rid of a reminder. Requires a reminder_id from a previous search result.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                reminder_id: {
                    type: "string",
                    description: "ID of the reminder to delete. This must come from a previous search result."
                }
            },
            required: ["reminder_id"]
        }
    }
}

// ============================================================
// REAL TOOL HANDLERS (Phase 2 - database operations)
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
    // Just echo back the input as a "draft"
    return {
        success: true,
        draft: {
            ...toolInput,
            is_draft: true
        },
        message: "I've drafted a reminder for you. Please review it above."
    }
}

async function handleSearchReminders(
    toolInput: any,
    userId: string,
    adminSecret: string,
    supabaseUrl: string
) {
    console.log('[DB] search_reminders (delegating to nova-search):', JSON.stringify(toolInput, null, 2))

    const { query, start_date, end_date } = toolInput

    // Construct the nova-search URL
    const novaSearchUrl = `${supabaseUrl}/functions/v1/nova-search`

    try {
        const response = await fetch(novaSearchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
                'x-admin-secret': adminSecret
            },
            body: JSON.stringify({
                query: query || "reminders",
                dev_user_id: userId,
                // Pass explicit date range if available
                start_date: start_date,
                end_date: end_date
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[Search Error] nova-search failed:', response.status, errorText)
            return {
                success: false,
                error: `Search failed: ${response.statusText}`
            }
        }

        const data = await response.json()
        const evidence = data.evidence || []

        console.log(`[Nova Agent] Received ${evidence.length} results from nova-search`)

        // Map nova-search evidence to tool output format
        return {
            reminders: evidence.map((r: any) => ({
                id: r.reminder_id,
                title: r.title,
                date: r.date,
                time: r.time,
                completed: r.completed,
                similarity: r.score
            })),
            count: evidence.length,
            message: data.answer || 'Search completed'
        }

    } catch (error: any) {
        console.error('[Search Error] Exception calling nova-search:', error)
        return { success: false, error: error.message }
    }
}

async function handleUpdateReminder(toolInput: any, userId: string, supabase: any) {
    console.log('[DB] update_reminder:', JSON.stringify(toolInput, null, 2))

    const updates: any = {}
    if (toolInput.title !== undefined) updates.title = toolInput.title
    if (toolInput.date !== undefined) updates.date = toolInput.date
    if (toolInput.time !== undefined) updates.time = toolInput.time
    if (toolInput.completed !== undefined) updates.completed = toolInput.completed
    if (toolInput.notes !== undefined) updates.notes = toolInput.notes

    const { data, error } = await supabase
        .from('reminders')
        .update(updates)
        .eq('id', toolInput.reminder_id)
        .eq('user_id', userId) // Security check
        .select()
        .single()

    if (error) {
        console.error('[DB Error] update_reminder:', error)
        return { success: false, error: error.message }
    }

    return {
        success: true,
        reminder: {
            id: data.id,
            title: data.title,
            date: data.date,
            time: data.time,
            completed: data.completed
        },
        message: "Reminder updated successfully"
    }
}

async function handleDeleteReminder(toolInput: any, userId: string, supabase: any) {
    console.log('[DB] delete_reminder:', JSON.stringify(toolInput, null, 2))

    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', toolInput.reminder_id)
        .eq('user_id', userId) // Security check

    if (error) {
        console.error('[DB Error] delete_reminder:', error)
        return { success: false, error: error.message }
    }

    return {
        success: true,
        reminder_id: toolInput.reminder_id,
        message: "Reminder deleted successfully"
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

        const { query, user_id: body_user_id, client_date } = body

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

        // Admin bypass pattern from ai-search
        const adminSecret = req.headers.get('x-admin-secret')
        if (adminSecret && adminSecret === ADMIN_SECRET_KEY && body_user_id) {
            console.log('[Nova Agent] Admin Bypass - Using user:', body_user_id)
            userId = body_user_id
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        } else {
            // Standard JWT authentication
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
        // FETCH USER'S TAGS & PRIORITIES
        // ============================================================

        const [tagsRes, prioritiesRes, commonTimesRes] = await Promise.all([
            supabaseClient.from('tags').select('id, name, color').eq('user_id', userId).order('name'),
            supabaseClient.from('priorities').select('id, name, color, rank').eq('user_id', userId).order('rank'),
            supabaseClient.from('common_times').select('morning, afternoon, evening, night').eq('user_id', userId).maybeSingle()
        ])

        const userTags = tagsRes.data || []
        const userPriorities = prioritiesRes.data || []
        const commonTimes = commonTimesRes.data || { morning: '09:00', afternoon: '14:00', evening: '18:00', night: '21:00' }

        const tagsContext = userTags.length > 0
            ? `Available tags: ${userTags.map((t: any) => t.name).join(', ')}`
            : 'No tags configured.'

        const prioritiesContext = userPriorities.length > 0
            ? `Available priorities: ${userPriorities.map((p: any) => p.name).join(', ')}`
            : 'No priorities configured.'

        const commonTimesContext = `Common Times:
- Morning: ${commonTimes.morning}
- Afternoon: ${commonTimes.afternoon}
- Evening: ${commonTimes.evening}
- Night: ${commonTimes.night}`

        console.log('[Nova Agent] Tags:', userTags.length, 'Priorities:', userPriorities.length, 'Common Times found:', !!commonTimesRes.data)

        // ============================================================
        // DATE CONTEXT (so Nova can resolve relative dates)
        // ============================================================

        let now: Date
        let todayStr: string

        if (client_date) {
            // Use client provided date
            todayStr = client_date
            // Parse YYYY-MM-DD as UTC to avoid timezone shifts
            now = new Date(client_date + 'T12:00:00Z')
        } else {
            // Fallback to server time
            now = new Date()
            todayStr = now.toISOString().split('T')[0]
        }

        const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
        const monthName = now.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
        const dayOfMonth = now.getDate() // Returns day of month (1-31) in local time (which matches UTC if we constructed carefully or use getUTCDate) 
        // Actually, if we use new Date('...Z'), methods like getDate() return browser/system local. 
        // In Deno Deploy, system is UTC. So getDate() === getUTCDate().
        const year = now.getFullYear()

        // Let's use getUTC* methods to be safe since we constructed with Z
        const utcDayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
        const utcMonthName = now.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
        const utcDayOfMonth = now.getUTCDate()
        const utcYear = now.getUTCFullYear()

        const fullToday = `${utcDayOfWeek}, ${utcMonthName} ${utcDayOfMonth}, ${utcYear} (${todayStr})`

        const tomorrow = new Date(now)
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        // ============================================================
        // BEDROCK CONVERSE API WITH TOOLS
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
            { toolSpec: searchRemindersTool },
            { toolSpec: updateReminderTool },
            { toolSpec: deleteReminderTool }
        ]

        const systemPrompt = `You are a helpful reminders assistant. Today is ${fullToday}. Tomorrow is ${tomorrowStr}.

${tagsContext}
${prioritiesContext}
${commonTimesContext}

When the user asks you to create a reminder, use the draft_reminder tool by default. This allows the user to review the details.
ONLY use create_reminder if the user explicitly says "create immediately", "do it now", "confirm", or "book it" without review.
If the user mentions a category or tag, set the tag_name field. If they mention a priority, set the priority_name field.
Extract any relevant context or details into the 'notes' field (e.g., "call mom about the party" -> title: "Call Mom", notes: "About the party").

When the user asks what reminders they have or searches for reminders, use the search_reminders tool.
When the user wants to change, reschedule, or complete a reminder, use the update_reminder tool.
When the user wants to remove or delete a reminder, use the delete_reminder tool.

RULES:
- Always calculate actual dates from relative references (e.g., "tomorrow" = ${tomorrowStr}).
- Use the user's defined "Common Times" when they use vague terms:
  - "morning" -> use Morning time (${commonTimes.morning})
  - "afternoon" -> use Afternoon time (${commonTimes.afternoon})
  - "evening" / "tonight" -> use Evening time (${commonTimes.evening})
  - "night" -> use Night time (${commonTimes.night})
- For date ranges, always set both start_date and end_date:
  - Single day (e.g., "tomorrow") → start_date and end_date = ${tomorrowStr}
  - "this week" → start_date = ${todayStr}, end_date = the coming Sunday
  - "next week" → start_date = next Monday, end_date = next Sunday
  - "this month" → start_date = ${todayStr}, end_date = last day of the month
- For keyword searches (e.g., "find my gym reminders"), use the query field instead of dates.
- Keep reminder titles concise (max 6 words).
- Convert times to 24-hour format (e.g., "7pm" = "19:00").
- If the user asks for multiple things, handle each one by calling the appropriate tools.
- After performing actions, give a brief, friendly confirmation.
- If info is missing (e.g., no date specified), ask the user to clarify.
- When presenting a draft (draft_reminder), explicitly ask if they want to add valid details to the notes (e.g., "Do you want to add any specifics about what to discuss?").
- CRITICALLY IMPORTANT: After calling draft_reminder, you MUST STOP. Do not search, do not create, do not do anything else. Just output a final message asking the user to review.
- When assigning tags or priorities, use the exact names from the available lists above.
- If the user specifies a time-limited repeat (e.g., "every Monday for 2 months"), set repeat to the pattern and repeat_until to the calculated end date.
- Never wrap your response in XML tags like <thinking> or <response>. Just respond naturally.`

        // Build conversation messages
        let conversationMessages: any[] = [{
            role: "user",
            content: [{ text: query }]
        }]

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
                // Nova wants to call one or more tools
                const assistantMessage = response.output?.message
                if (!assistantMessage) {
                    throw new Error('No assistant message in tool_use response')
                }

                // Add assistant's message to conversation
                conversationMessages.push(assistantMessage)

                // Find all tool use blocks in the response
                const toolUseBlocks = assistantMessage.content?.filter((c: any) => c.toolUse) || []

                // Process each tool call - build a single user message with all tool results
                const toolResultContents: any[] = []

                for (const toolUseBlock of toolUseBlocks) {
                    const toolName = toolUseBlock.toolUse.name
                    const toolInput = toolUseBlock.toolUse.input
                    const toolUseId = toolUseBlock.toolUse.toolUseId

                    console.log(`[Tool Call] ${toolName}`)
                    console.log('[Tool Input]', JSON.stringify(toolInput, null, 2))

                    // Execute real tool
                    let toolResult: any
                    if (toolName === "draft_reminder") {
                        toolResult = handleDraftReminder(toolInput)
                    } else if (toolName === "create_reminder") {
                        toolResult = await handleCreateReminder(toolInput, userId, supabaseClient)
                    } else if (toolName === "search_reminders") {
                        toolResult = await handleSearchReminders(toolInput, userId, ADMIN_SECRET_KEY, SUPABASE_URL)
                    } else if (toolName === "update_reminder") {
                        toolResult = await handleUpdateReminder(toolInput, userId, supabaseClient)
                    } else if (toolName === "delete_reminder") {
                        toolResult = await handleDeleteReminder(toolInput, userId, supabaseClient)
                    } else {
                        toolResult = { error: `Unknown tool: ${toolName}` }
                    }

                    // Log the tool call for response
                    toolCallLog.push({
                        tool: toolName,
                        input: toolInput,
                        result: toolResult,
                        iteration: iterationCount
                    })

                    // Add this tool result to the batch
                    toolResultContents.push({
                        toolResult: {
                            toolUseId: toolUseId,
                            content: [{ json: toolResult }]
                        }
                    })
                }

                // Add all tool results as a single user message
                conversationMessages.push({
                    role: "user",
                    content: toolResultContents
                })

            } else if (stopReason === "end_turn") {
                // Nova is done - extract final text response
                const rawText = response.output?.message?.content?.find((c: any) => c.text)?.text
                    || "Done!"

                // Strip <thinking>...</thinking> and <response>...</response> XML tags Nova sometimes adds
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
                // Unexpected stop reason
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
