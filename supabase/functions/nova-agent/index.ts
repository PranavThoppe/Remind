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

const draftUpdateReminderTool = {
    name: "draft_update_reminder",
    description: "Proposes an update to an existing reminder. Use this by DEFAULT when the user wants to change, modify, reschedule, or mark a reminder as complete. The frontend will ask the user to confirm. Requires a reminder_id.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                reminder_id: {
                    type: "string",
                    description: "ID of the reminder to update. This must come from a previous search result or the pinned active context."
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

const saveContextTool = {
    name: "save_context",
    description: "Save a term, acronym, or fact about the user to their personal glossary. Use when the user explains what something means, corrects a tag assignment, or provides personal context you should remember. For tag definitions, use 'tag:<name>' as the key.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                key: {
                    type: "string",
                    description: "The term, acronym, or 'tag:<name>' (e.g., 'APUSH', 'Mom', 'tag:app')."
                },
                value: {
                    type: "string",
                    description: "What it means in the user's context (e.g., 'AP US History', 'Phone 555-1234', 'Only for coding tasks')."
                }
            },
            required: ["key", "value"]
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

function handleDraftUpdateReminder(toolInput: any) {
    console.log('[Agent] draft_update_reminder:', JSON.stringify(toolInput, null, 2))
    return {
        success: true,
        draft: {
            ...toolInput,
            is_draft: true
        },
        message: "I've drafted the updates for your reminder. Please review and confirm."
    }
}

async function handleSearchReminders(
    toolInput: any,
    userId: string,
    adminSecret: string,
    supabaseUrl: string,
    supabaseClient: any
) {
    console.log('[DB] search_reminders:', JSON.stringify(toolInput, null, 2))
    const { query, start_date, end_date } = toolInput

    // 1. Strict SQL Search First
    try {
        let dbQuery = supabaseClient
            .from('reminders')
            .select('*')
            .eq('user_id', userId)

        if (start_date) {
            dbQuery = dbQuery.gte('date', start_date)
        }
        if (end_date) {
            dbQuery = dbQuery.lte('date', end_date)
        }
        if (query && query.trim() !== '' && query.toLowerCase() !== 'reminders') {
            dbQuery = dbQuery.ilike('title', `%${query}%`)
        }

        // Limit results to keep context small
        dbQuery = dbQuery.order('date', { ascending: true }).limit(5)

        const { data: strictData, error: strictError } = await dbQuery

        if (strictError) {
            console.error('[Search Error] Strict query failed:', strictError)
        } else if (strictData && strictData.length > 0) {
            console.log(`[Nova Agent] Found ${strictData.length} results via strict SQL`)
            return {
                reminders: strictData.map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    date: r.date,
                    time: r.time,
                    completed: r.completed,
                    tag_id: r.tag_id,
                    priority_id: r.priority_id,
                    similarity: 1.0 // Exact match
                })),
                count: strictData.length,
                message: `Found ${strictData.length} reminders via exact match.`
            }
        }
    } catch (e) {
        console.error('[Search Error] Exception in strict search:', e)
    }

    // 2. Semantic Fallback (nova-search)
    console.log('[DB] Falling back to nova-search for semantic search...')
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

        return {
            reminders: evidence.map((r: any) => ({
                id: r.reminder_id,
                title: r.title,
                date: r.date,
                time: r.time,
                completed: r.completed,
                tag_id: r.tag_id,
                priority_id: r.priority_id,
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

async function handleSaveContext(toolInput: any, userId: string, supabase: any) {
    console.log('[DB] save_context:', JSON.stringify(toolInput, null, 2))

    const { error } = await supabase
        .from('user_context')
        .upsert({
            user_id: userId,
            key: toolInput.key,
            value: toolInput.value,
            last_used_at: new Date().toISOString()
        }, {
            onConflict: 'user_id, key'
        })

    if (error) {
        console.error('[DB Error] save_context:', error)
        return { success: false, error: error.message }
    }

    return {
        success: true,
        key: toolInput.key,
        value: toolInput.value,
        message: "Context saved successfully! I will remember this."
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

        const [tagsRes, prioritiesRes, commonTimesRes, contextRes] = await Promise.all([
            supabaseClient.from('tags').select('id, name, color, description').eq('user_id', userId).order('name'),
            supabaseClient.from('priorities').select('id, name, color, rank').eq('user_id', userId).order('rank'),
            supabaseClient.from('common_times').select('morning, afternoon, evening, night').eq('user_id', userId).maybeSingle(),
            supabaseClient.from('user_context').select('key, value').eq('user_id', userId).order('last_used_at', { ascending: false }).limit(50)
        ])

        const userTags = tagsRes.data || []
        const userPriorities = prioritiesRes.data || []
        const commonTimes = commonTimesRes.data || { morning: '09:00', afternoon: '14:00', evening: '18:00', night: '21:00' }
        const userContextItems = contextRes.data || []

        const tagsContext = userTags.length > 0
            ? `Available tags:\n${userTags.map((t: any) => `- ${t.name}${t.description ? ` (Description: ${t.description})` : ''}`).join('\n')}`
            : 'No tags configured.'

        const prioritiesContext = userPriorities.length > 0
            ? `Available priorities: ${userPriorities.map((p: any) => p.name).join(', ')}`
            : 'No priorities configured.'

        const commonTimesContext = `Common Times:
- Morning: ${commonTimes.morning}
- Afternoon: ${commonTimes.afternoon}
- Evening: ${commonTimes.evening}
- Night: ${commonTimes.night}`

        const userContextSection = userContextItems.length > 0
            ? `USER CONTEXT (things you already know about the user):\n${userContextItems.map((c: any) => `- ${c.key} = ${c.value}`).join('\n')}`
            : ''

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

        // Generate next 7 days list for better disambiguation
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
            { toolSpec: draftUpdateReminderTool },
            { toolSpec: deleteReminderTool },
            { toolSpec: saveContextTool }
        ]

        const systemPrompt = `You are a helpful reminders assistant. Today is ${fullToday}.
 
${next7DaysContext}

${tagsContext}
${prioritiesContext}
${commonTimesContext}

${userContextSection}

When the user asks you to create a reminder, use the draft_reminder tool by default. This allows the user to review the details.
ONLY use create_reminder if the user explicitly says "create immediately", "do it now", "confirm", or "book it" without review.
CONFLICT DETECTION: When the user wants to add a new reminder, you MUST first check for conflicts if a time is specified. If the user specifies a date and time, call search_reminders first with start_date and end_date matching the desired date to see if there are any existing reminders within 30 minutes of the requested time. If there is a conflict, point it out and ask the user how to handle it before calling draft_reminder.
If the user mentions a category or tag, set the tag_name field. If they mention a priority, set the priority_name field.
Extract any relevant context or details into the 'notes' field (e.g., "call mom about the party" -> title: "Call Mom", notes: "About the party").

When the user explicitly asks to find, search for, or list their reminders (e.g., "What do I have tomorrow?", "Show my gym reminders"), use the search_reminders tool.
DO NOT use search_reminders for general statements or stories (e.g., "I went to the gym today") unless the user is asking you for info about those reminders.
When the user wants to change, reschedule, or complete a reminder, use the draft_update_reminder tool. YOU MUST ALWAYS DRAFT UPDATES before applying them.
The user may explicitly pin a reminder to the context. This will appear at the end of their message in brackets like "[Active Context: Reminder ID ...]". When this is present, you MUST assume any subsequent update commands in that message refer to THIS exact reminder.
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
- After performing actions, give a brief, friendly confirmation.
- If info is missing (e.g., no date specified), ask the user to clarify.
- When presenting a draft (draft_reminder), explicitly ask if they want to add valid details to the notes (e.g., "Do you want to add any specifics?").
- CRITICALLY IMPORTANT: After calling draft_reminder or draft_update_reminder, you MUST STOP. Do not search, do not create, do not do anything else. Just output a final message asking the user to review.
- When assigning tags or priorities, use the exact names from the available lists above.
- If the user specifies a time-limited repeat (e.g., "every Monday for 2 months"), set repeat to the pattern and repeat_until to the calculated end date.
- DISAMBIGUATION RULES:
  - When a user mentions a day (e.g., "Monday") and there is ambiguity (e.g., it's currently Sunday or Monday):
    - "this Monday" or just "Monday" usually refers to the very next occurrence (${next7Days[1]?.split(': ')[1] || 'soon'}).
    - "next Monday" refers to the occurrence AFTER the coming one.
  - Always check the 'Upcoming Dates' list above to ensure you are suggesting valid dates.
- Never wrap your response in XML tags like <thinking> or <response>. 
- When you encounter an unfamiliar acronym or ambiguous term, ask the user what it means BEFORE creating the reminder. Use save_context to remember their answer.
- Use the USER CONTEXT section above to understand tag meanings. Only assign a tag if the reminder genuinely matches the tag's description or learned context.
- If a user corrects a tag assignment ("no, 'app' is only for coding"), save that correction with save_context using key "tag:<name>".
- If the user proactively tells you that a type of reminder or activity belongs to a specific tag (e.g., "standups are for the L3 tag", "grocery runs go under Home"), ALWAYS call save_context with key "tag:<name>" and a value describing what belongs there — even if you are also calling draft_reminder or draft_update_reminder in the same turn.
- More broadly, if the user volunteers any personal fact about their habits, categories, or preferences that you should remember for future sessions, call save_context to persist it.
- Do NOT ask follow-up questions for simple, clear requests (e.g., "Remind me to buy milk tomorrow").
- BE CONCISE: Avoid conversational filler, unnecessary pleasantries, or off-topic comments. Focus strictly on the user's reminders.`

        // Build conversation messages from history
        let conversationMessages: any[] = []

        if (Array.isArray(conversation) && conversation.length > 0) {
            // Map client ChatMessage to Bedrock Converse message format
            conversationMessages = conversation.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: [{ text: msg.content }]
            }))

            // Bedrock REQUIREMENT: Conversation must start with a 'user' message.
            // If the first message is from assistant, drop it and any subsequent assistant messages
            // until we find a user message.
            while (conversationMessages.length > 0 && conversationMessages[0].role !== 'user') {
                console.log('[Nova Agent] Dropping leading assistant message to satisfy Bedrock requirements')
                conversationMessages.shift()
            }

            // Bedrock REQUIREMENT: Roles must alternate.
            // If the last message in history is 'user', and we are about to add the current 'query' (also 'user'),
            // we should merge them or insert a placeholder assistant message (less ideal).
            // Actually, the client should send us history where the last message is assistant.
            // If history ends with 'user', we'll just keep it and Bedrock might fail OR we can merge.
        }

        // Add the current query as the latest user message
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
                        toolResult = await handleSearchReminders(toolInput, userId, ADMIN_SECRET_KEY, SUPABASE_URL, supabaseClient)
                    } else if (toolName === "draft_update_reminder") {
                        toolResult = handleDraftUpdateReminder(toolInput)
                    } else if (toolName === "delete_reminder") {
                        toolResult = await handleDeleteReminder(toolInput, userId, supabaseClient)
                    } else if (toolName === "save_context") {
                        toolResult = await handleSaveContext(toolInput, userId, supabaseClient)
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
