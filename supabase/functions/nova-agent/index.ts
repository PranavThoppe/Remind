import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
                    description: "Natural language search query describing what to search for (e.g., 'doctor', 'what's tomorrow', 'gym reminders')."
                },
                target_date: {
                    type: "string",
                    description: "Specific date to filter results in YYYY-MM-DD format. Use when user asks about a specific day."
                }
            },
            required: ["query"]
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
                }
            },
            required: ["reminder_id"]
        }
    }
}

// ============================================================
// MOCK TOOL HANDLERS (Phase 1 - no real database operations)
// ============================================================

function handleCreateReminder(toolInput: any) {
    console.log('[MOCK] create_reminder called with:', JSON.stringify(toolInput, null, 2))

    return {
        success: true,
        reminder: {
            id: "mock-reminder-" + Date.now(),
            title: toolInput.title,
            date: toolInput.date,
            time: toolInput.time || null,
            repeat: toolInput.repeat || "none",
            completed: false
        },
        message: "Mock reminder created successfully"
    }
}

function handleSearchReminders(toolInput: any) {
    console.log('[MOCK] search_reminders called with:', JSON.stringify(toolInput, null, 2))

    // Return a few fake reminders so Nova can format a response
    return {
        reminders: [
            {
                id: "mock-1",
                title: "Buy groceries",
                date: toolInput.target_date || "2026-02-16",
                time: "19:00",
                completed: false
            },
            {
                id: "mock-2",
                title: "Gym workout",
                date: toolInput.target_date || "2026-02-16",
                time: "06:00",
                completed: false
            },
            {
                id: "mock-3",
                title: "Team meeting",
                date: toolInput.target_date || "2026-02-16",
                time: "14:00",
                completed: false
            }
        ],
        count: 3,
        message: "Mock search completed"
    }
}

function handleUpdateReminder(toolInput: any) {
    console.log('[MOCK] update_reminder called with:', JSON.stringify(toolInput, null, 2))

    return {
        success: true,
        reminder: {
            id: toolInput.reminder_id,
            title: toolInput.title || "Updated reminder",
            date: toolInput.date || "2026-02-16",
            time: toolInput.time || null,
            completed: toolInput.completed || false
        },
        message: "Mock reminder updated successfully"
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

        // Verify admin secret
        const adminSecret = req.headers.get('x-admin-secret')
        if (!adminSecret || adminSecret !== ADMIN_SECRET_KEY) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid admin secret' }), {
                status: 401,
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

        const { query, user_id } = body

        if (!query) {
            return new Response(JSON.stringify({ error: 'Query required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!user_id) {
            return new Response(JSON.stringify({ error: 'user_id is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log('[Nova Agent] User:', user_id, 'Query:', query)

        // ============================================================
        // DATE CONTEXT (so Nova can resolve relative dates)
        // ============================================================

        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
        const monthName = now.toLocaleDateString('en-US', { month: 'long' })
        const dayOfMonth = now.getDate()
        const year = now.getFullYear()
        const fullToday = `${dayOfWeek}, ${monthName} ${dayOfMonth}, ${year} (${todayStr})`

        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
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
            { toolSpec: createReminderTool },
            { toolSpec: searchRemindersTool },
            { toolSpec: updateReminderTool }
        ]

        const systemPrompt = `You are a helpful reminders assistant. Today is ${fullToday}. Tomorrow is ${tomorrowStr}.

When the user asks you to create a reminder, use the create_reminder tool.
When the user asks what reminders they have or searches for reminders, use the search_reminders tool.
When the user wants to change, reschedule, or complete a reminder, use the update_reminder tool.

RULES:
- Always calculate actual dates from relative references (e.g., "tomorrow" = ${tomorrowStr}).
- Keep reminder titles concise (max 6 words).
- Convert times to 24-hour format (e.g., "7pm" = "19:00").
- If the user asks for multiple things, handle each one by calling the appropriate tools.
- After performing actions, give a brief, friendly confirmation.
- If info is missing (e.g., no date specified), ask the user to clarify.`

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

                    // Execute mock tool
                    let toolResult: any
                    if (toolName === "create_reminder") {
                        toolResult = handleCreateReminder(toolInput)
                    } else if (toolName === "search_reminders") {
                        toolResult = handleSearchReminders(toolInput)
                    } else if (toolName === "update_reminder") {
                        toolResult = handleUpdateReminder(toolInput)
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
                const finalText = response.output?.message?.content?.find((c: any) => c.text)?.text
                    || "Done!"

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
