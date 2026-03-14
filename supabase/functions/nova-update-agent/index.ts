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

const draftUpdateReminderTool = {
    name: "draft_update_reminder",
    description: "Proposes changes to the pinned reminder for the user to confirm. Use this BY DEFAULT for any change request (reschedule, rename, change time, mark complete, add notes, etc.). The user will see the proposed changes before they're applied.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                reminder_id: {
                    type: "string",
                    description: "ID of the reminder to update. Always use the pinned reminder ID provided in the system prompt."
                },
                title: {
                    type: "string",
                    description: "New title. Only include if user wants to change it."
                },
                date: {
                    type: "string",
                    description: "New date in YYYY-MM-DD format. Only include if rescheduling."
                },
                time: {
                    type: "string",
                    description: "New time in HH:mm 24-hour format. Only include if changing the time. Pass null or empty string if the user explicitly wants to remove the time (e.g., 'change it to anytime')."
                },
                repeat: {
                    type: "string",
                    description: "New recurrence pattern using RFC 5545 RRULE format. Examples: 'FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=TU,TH', 'FREQ=MONTHLY;BYMONTHDAY=1' or 'none'. Only include if changing it."
                },
                repeat_until: {
                    type: "string",
                    description: "End date for a time-limited repeat in YYYY-MM-DD format."
                },
                completed: {
                    type: "boolean",
                    description: "Set to true if user wants to mark as done/complete."
                },
                notes: {
                    type: "string",
                    description: "New or updated notes. Only include if user wants to change notes."
                },
                tag_name: {
                    type: "string",
                    description: "New tag name. Must match one of the user's available tags. Pass empty string to remove the tag."
                },
                priority_name: {
                    type: "string",
                    description: "New priority name. Must match one of the user's available priorities. Pass empty string to remove."
                }
            },
            required: ["reminder_id"]
        }
    }
}

const updateReminderTool = {
    name: "update_reminder",
    description: "Immediately applies changes to the pinned reminder WITHOUT asking for confirmation. Only use if user explicitly says 'just do it', 'apply it now', 'confirm', or similar. Otherwise always use draft_update_reminder.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                reminder_id: { type: "string", description: "ID of the reminder to update." },
                title: { type: "string" },
                date: { type: "string", description: "YYYY-MM-DD format." },
                time: { type: "string", description: "HH:mm 24-hour format." },
                repeat: { type: "string", description: "RFC 5545 RRULE or 'none'" },
                repeat_until: { type: "string" },
                completed: { type: "boolean" },
                notes: { type: "string" },
                tag_name: { type: "string" },
                priority_name: { type: "string" }
            },
            required: ["reminder_id"]
        }
    }
}

const updateNotificationOffsetsTool = {
    name: "update_notification_offsets",
    description: "Sets custom notification alerts for a reminder. Use this when the user asks to be reminded before the core reminder time.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                reminder_id: { type: "string" },
                offsets: {
                    type: "array",
                    items: { type: "number" },
                    description: "Array of minutes before the reminder time to trigger a notification (e.g., [10] for 10 mins before, [60] for 1 hour before, [1440] for 1 day before). Pass empty array [] to clear notifications."
                }
            },
            required: ["reminder_id", "offsets"]
        }
    }
}

const createSubtasksTool = {
    name: "create_subtasks",
    description: "Proposes breaking down the reminder into subtasks for the user to review. Use this when the user asks to add subtasks, break it down, make a plan, or implies a multi-step process.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                reminder_id: { type: "string" },
                subtasks: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of subtask titles to propose."
                }
            },
            required: ["reminder_id", "subtasks"]
        }
    }
}

const updateSubtasksTool = {
    name: "update_subtasks",
    description: "Immediately sets the subtasks directly without needing confirmation. ONLY use this when the user EXPLICITLY lists out exactly what the subtasks should be.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                reminder_id: { type: "string" },
                subtasks: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of subtask titles to explicitly save."
                }
            },
            required: ["reminder_id", "subtasks"]
        }
    }
}

const searchRemindersTool = {
    name: "search_reminders",
    description: "Search existing reminders, mainly for conflict detection when rescheduling. E.g. check if another reminder already exists at the new time.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                query: { type: "string", description: "Keyword filter (optional)." },
                start_date: { type: "string", description: "YYYY-MM-DD (inclusive)." },
                end_date: { type: "string", description: "YYYY-MM-DD (inclusive)." }
            },
            required: []
        }
    }
}

const saveContextTool = {
    name: "save_context",
    description: "Save a term, acronym, or fact about the user. Use 'tag:<name>' as the key for tag definitions.",
    inputSchema: {
        json: {
            type: "object",
            properties: {
                key: { type: "string" },
                value: { type: "string" }
            },
            required: ["key", "value"]
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

function handleDraftUpdateReminder(toolInput: any, pinnedReminder: any, userTags: any[], userPriorities: any[]) {
    const currentTagName = pinnedReminder.tag_id
        ? userTags.find((t: any) => t.id === pinnedReminder.tag_id)?.name
        : null;
    const currentPriorityName = pinnedReminder.priority_id
        ? userPriorities.find((p: any) => p.id === pinnedReminder.priority_id)?.name
        : null;

    const originalReminder = {
        ...pinnedReminder,
        tag_name: currentTagName,
        priority_name: currentPriorityName
    };

    const proposedDraft = {
        title: toolInput.title !== undefined ? toolInput.title : pinnedReminder.title,
        date: toolInput.date !== undefined ? toolInput.date : pinnedReminder.date,
        time: toolInput.time !== undefined ? toolInput.time : pinnedReminder.time,
        repeat: toolInput.repeat !== undefined ? toolInput.repeat : pinnedReminder.repeat,
        repeat_until: toolInput.repeat_until !== undefined ? toolInput.repeat_until : pinnedReminder.repeat_until,
        completed: toolInput.completed !== undefined ? toolInput.completed : pinnedReminder.completed,
        notes: toolInput.notes !== undefined ? toolInput.notes : pinnedReminder.notes,
        tag_name: toolInput.tag_name !== undefined ? (toolInput.tag_name === "" ? null : toolInput.tag_name) : currentTagName,
        priority_name: toolInput.priority_name !== undefined ? (toolInput.priority_name === "" ? null : toolInput.priority_name) : currentPriorityName
    };

    console.log('\n=========================================');
    console.log('[Nova Update Agent] draft_update_reminder');
    console.log('--- BEFORE (Original State) ---');
    console.log(JSON.stringify(originalReminder, null, 2));
    console.log('--- APPLIED DIFF ---');
    console.log(JSON.stringify(toolInput, null, 2));
    console.log('--- AFTER (Proposed Draft) ---');
    console.log(JSON.stringify(proposedDraft, null, 2));
    console.log('=========================================\n');

    return {
        success: true,
        draft: { ...toolInput, is_draft: true },
        message: "Here's the proposed update — take a look and confirm!"
    }
}

async function handleUpdateReminder(toolInput: any, userId: string, supabase: any, pinnedReminder: any, userTags: any[], userPriorities: any[]) {
    const currentTagName = pinnedReminder.tag_id
        ? userTags.find((t: any) => t.id === pinnedReminder.tag_id)?.name
        : null;
    const currentPriorityName = pinnedReminder.priority_id
        ? userPriorities.find((p: any) => p.id === pinnedReminder.priority_id)?.name
        : null;

    const originalReminder = {
        ...pinnedReminder,
        tag_name: currentTagName,
        priority_name: currentPriorityName
    };

    let tagId: string | null | undefined = undefined
    let newTagName: string | null = currentTagName;
    if (toolInput.tag_name !== undefined) {
        if (toolInput.tag_name === "") {
            tagId = null
            newTagName = null;
        } else {
            const { data: tagData } = await supabase
                .from('tags').select('id').eq('user_id', userId)
                .ilike('name', toolInput.tag_name).limit(1).single()
            tagId = tagData?.id || null
            newTagName = toolInput.tag_name;
        }
    }

    let priorityId: string | null | undefined = undefined
    let newPriorityName: string | null = currentPriorityName;
    if (toolInput.priority_name !== undefined) {
        if (toolInput.priority_name === "") {
            priorityId = null
            newPriorityName = null;
        } else {
            const { data: priorityData } = await supabase
                .from('priorities').select('id').eq('user_id', userId)
                .ilike('name', toolInput.priority_name).limit(1).single()
            priorityId = priorityData?.id || null
            newPriorityName = toolInput.priority_name;
        }
    }

    const proposedDraft = {
        title: toolInput.title !== undefined ? toolInput.title : pinnedReminder.title,
        date: toolInput.date !== undefined ? toolInput.date : pinnedReminder.date,
        time: toolInput.time !== undefined ? toolInput.time : pinnedReminder.time,
        repeat: toolInput.repeat !== undefined ? toolInput.repeat : pinnedReminder.repeat,
        repeat_until: toolInput.repeat_until !== undefined ? toolInput.repeat_until : pinnedReminder.repeat_until,
        completed: toolInput.completed !== undefined ? toolInput.completed : pinnedReminder.completed,
        notes: toolInput.notes !== undefined ? toolInput.notes : pinnedReminder.notes,
        tag_name: newTagName,
        priority_name: newPriorityName
    };

    console.log('\n=========================================');
    console.log('[Nova Update Agent DB] update_reminder (IMMEDIATE)');
    console.log('--- BEFORE (Original State) ---');
    console.log(JSON.stringify(originalReminder, null, 2));
    console.log('--- APPLIED DIFF ---');
    console.log(JSON.stringify(toolInput, null, 2));
    console.log('--- AFTER (Saved State) ---');
    console.log(JSON.stringify(proposedDraft, null, 2));
    console.log('=========================================\n');

    const updates: any = {}
    if (toolInput.title !== undefined) updates.title = toolInput.title
    if (toolInput.date !== undefined) updates.date = toolInput.date
    if (toolInput.time !== undefined) updates.time = toolInput.time
    if (toolInput.repeat !== undefined) updates.repeat = toolInput.repeat
    if (toolInput.repeat_until !== undefined) updates.repeat_until = toolInput.repeat_until
    if (toolInput.completed !== undefined) updates.completed = toolInput.completed
    if (toolInput.notes !== undefined) updates.notes = toolInput.notes
    if (tagId !== undefined) updates.tag_id = tagId
    if (priorityId !== undefined) updates.priority_id = priorityId

    const { data, error } = await supabase
        .from('reminders')
        .update(updates)
        .eq('id', toolInput.reminder_id)
        .eq('user_id', userId)
        .select()
        .single()

    if (error) {
        console.error('[Nova Update Agent DB Error] update_reminder:', error)
        return { success: false, error: error.message }
    }

    return {
        success: true,
        reminder: { id: data.id, title: data.title, date: data.date, time: data.time },
        message: "Reminder updated!"
    }
}

async function handleSearchReminders(
    toolInput: any,
    userId: string,
    adminSecret: string,
    supabaseUrl: string,
    supabaseClient: any
) {
    console.log('[Nova Update Agent DB] search_reminders:', JSON.stringify(toolInput, null, 2))
    const { query, start_date, end_date } = toolInput

    let dbQuery = supabaseClient.from('reminders').select('*').eq('user_id', userId)
    if (start_date) dbQuery = dbQuery.gte('date', start_date)
    if (end_date) dbQuery = dbQuery.lte('date', end_date)
    if (query && query.trim()) dbQuery = dbQuery.ilike('title', `%${query}%`)
    dbQuery = dbQuery.order('date', { ascending: true }).limit(5)

    const { data, error } = await dbQuery
    if (error) return { success: false, error: error.message }

    return {
        reminders: (data || []).map((r: any) => ({
            id: r.id, title: r.title, date: r.date, time: r.time,
            completed: r.completed, tag_id: r.tag_id, priority_id: r.priority_id
        })),
        count: data?.length || 0
    }
}

async function handleSaveContext(toolInput: any, userId: string, supabase: any) {
    const { error } = await supabase.from('user_context').upsert({
        user_id: userId, key: toolInput.key, value: toolInput.value,
        last_used_at: new Date().toISOString()
    }, { onConflict: 'user_id, key' })

    if (error) return { success: false, error: error.message }
    return { success: true, key: toolInput.key, value: toolInput.value }
}

// ============================================================
// MAIN SERVER
// ============================================================

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID')
        const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY')
        const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1'
        const ADMIN_SECRET_KEY = Deno.env.get('ADMIN_SECRET_KEY')!

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

        // `reminder` is the pinned reminder object, required for this agent
        const { query, user_id: body_user_id, client_date, conversation, reminder: pinnedReminder } = body

        if (!query) {
            return new Response(JSON.stringify({ error: 'Query required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
        if (!pinnedReminder?.id) {
            return new Response(JSON.stringify({ error: 'A pinned reminder object is required for nova-update-agent' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── Auth ──────────────────────────────────────────────────────────
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        let userId: string
        let supabaseClient: any

        const adminSecret = req.headers.get('x-admin-secret')
        if (adminSecret && adminSecret === ADMIN_SECRET_KEY && body_user_id) {
            userId = body_user_id
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        } else {
            const authHeader = req.headers.get('Authorization')
            if (!authHeader) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: authHeader } }
            })
            const { data: { user: authUser }, error: userError } = await supabaseClient.auth.getUser()
            if (userError || !authUser) {
                return new Response(JSON.stringify({ error: 'Unauthorized: Invalid JWT' }), {
                    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            userId = authUser.id
        }

        console.log('[Nova Update Agent] User:', userId, 'Reminder:', pinnedReminder.id, 'Query:', query)

        // ── Fetch user context (tags, priorities, common times, saved context) ──
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

        const userContextSection = userContextItems.length > 0
            ? `USER CONTEXT:\n${userContextItems.map((c: any) => `- ${c.key} = ${c.value}`).join('\n')}`
            : ''

        const timeFormatItem = userContextItems.find((c: any) => c.key === 'time_format');
        const time_format = timeFormatItem ? timeFormatItem.value : '12h';

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
        const tomorrow = new Date(now)
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        const next7Days: string[] = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(now)
            d.setUTCDate(d.getUTCDate() + i)
            const label = i === 0 ? ' (Today)' : i === 1 ? ' (Tomorrow)' : ''
            next7Days.push(`${d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}${label}: ${d.toISOString().split('T')[0]}`)
        }

        // ── Pinned reminder summary for system prompt ─────────────────────
        const currentTagName = pinnedReminder.tag_id && userTags.length > 0
            ? userTags.find((t: any) => t.id === pinnedReminder.tag_id)?.name
            : null;

        const currentPriorityName = pinnedReminder.priority_id && userPriorities.length > 0
            ? userPriorities.find((p: any) => p.id === pinnedReminder.priority_id)?.name
            : null;

        const reminderSummary = [
            `ID: ${pinnedReminder.id}`,
            `Title: ${pinnedReminder.title || 'Unknown'}`,
            pinnedReminder.date ? `Date: ${pinnedReminder.date}` : `Date: Not set`,
            pinnedReminder.time ? `Time: ${formatTime(pinnedReminder.time, time_format)}` : `Time: Not set`,
            pinnedReminder.repeat && pinnedReminder.repeat !== 'none' ? `Repeats: ${pinnedReminder.repeat}` : `Repeats: none`,
            currentTagName ? `Tag: ${currentTagName}` : null,
            currentPriorityName ? `Priority: ${currentPriorityName}` : null,
            pinnedReminder.notes ? `Notes: ${pinnedReminder.notes}` : null,
        ].filter(Boolean).join('\n')

        // ── Bedrock client & tools ────────────────────────────────────────
        const client = new BedrockRuntimeClient({
            region: AWS_REGION,
            credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY }
        })

        const tools = [
            { toolSpec: draftUpdateReminderTool },
            { toolSpec: updateReminderTool },
            { toolSpec: updateNotificationOffsetsTool },
            { toolSpec: createSubtasksTool },
            { toolSpec: updateSubtasksTool },
            { toolSpec: searchRemindersTool },
            { toolSpec: saveContextTool }
        ]

        const systemPrompt = `You are Nova, a friendly and extremely focused reminders assistant. The user has explicitly selected a SPECIFIC reminder to view or edit. YOUR ONLY PURPOSE in this session is to discuss or update THIS specific pinned reminder. Today is ${fullToday}.

PINNED REMINDER CONTEXT:
${reminderSummary}

Upcoming Dates (Next 7 Days):
${next7Days.join('\n')}

${tagsContext}
${prioritiesContext}
${commonTimesContext}
${userContextSection}

BEHAVIOUR:
- The user is talking EXCLUSIVELY about the PINNED REMINDER above. All commands (e.g., "change it to tomorrow", "what is the tag?", "mark it done") refer ONLY to this reminder.
- You have the EXACT current state of the reminder in the PINNED REMINDER CONTEXT above. Use it to accurately answer questions about its current title, date, time, tag, or priority.
- By default, ALWAYS use draft_update_reminder for any modification so the user can review proposed changes before they're applied.
- Only use update_reminder (immediate, no confirmation) if the user explicitly says "just do it", "apply now", "confirm", or similar.
- If the user asks to add subtasks, use create_subtasks to propose a list of subtasks.
- ONLY use update_subtasks if the user explicitly spells out exactly what subtasks to add (e.g., "add subtasks: 1st, 2nd, 3rd").
- If the user asks to "create a checklist", "break this down", "make a plan", "create a plan", or similar, interpret that as asking for subtasks for THIS reminder. Use create_subtasks.
- When generating subtasks based on the user's input, summarize and rephrase their natural language into concise, actionable subtask titles (e.g., instead of "I have to look at lecture notes", use "Review lecture notes"). If they ask you to "plan" or "break down" a topic they provided, generate logical, actionable subtasks for that topic.
- If the user asks for a checklist/plan but DOES NOT provide ANY topics or context, DO NOT generate the items yourself. Instead, use create_subtasks with an array of exactly 1 empty string (i.e. [""]) so the user can fill them out themselves or provide more info. Crucially, your text response MUST ask a clear question like "What would you like to plan?" or "What do you want to break down?" to invite the user to give you the topics.
- When the user subsequently replies to that question with topics (e.g., "a study guide for my AI midterm"), you should then use create_subtasks again to actually generate and populate the suggested subtasks based on their input.
- If the user asks to reschedule, use search_reminders first to check for conflicts at the new time, then draft the update.
- Always calculate actual dates from relative references (e.g., "tomorrow" = ${tomorrowStr}).
- If the user does not specify a time when creating/rescheduling or asks to remove the time, omit the time or pass null so it defaults to "Anytime".
- If the user uses vague time terms ("tonight", "morning"), use their Common Times and DO NOT ask clarifying questions: morning=${commonTimes.morning}, afternoon=${commonTimes.afternoon}, evening=${commonTimes.evening}, night=${commonTimes.night}.
- TIME FORMAT FOR TEXT: The user's preferred time format is ${time_format}. When speaking to the user in text, format times accordingly (e.g., if '12h', say "6:00 PM"; if '24h', say "18:00").
- TIME FORMAT FOR TOOLS: Regardless of the user's preference for text, you must ALWAYS use 24-hour 'HH:mm' format when calling tools like draft_update_reminder or update_reminder.
- Keep responses warm, short and focused.
- CRITICALLY IMPORTANT: After calling draft_update_reminder, create_subtasks, or update_reminder, you MUST STOP. Output a friendly message and wait for the user to confirm/reject the draft.
- Never wrap your response in XML tags like <thinking> or <response>.
- IF THE USER ASKS ABOUT SOMETHING TRULY UNRELATED TO THIS SPECIFIC REMINDER (e.g., "what's on my schedule today?", "create a new reminder for groceries", "how are you?"), gently but firmly redirect them: "I'm currently focused on editing this specific reminder. If you want to talk about something else or create a new reminder, please close this edit view and ask me in the main chat! 😊"
- Use save_context to remember any personal facts or tag corrections the user shares during this edit session.`

        // ── Build conversation ────────────────────────────────────────────
        let conversationMessages: any[] = []
        if (Array.isArray(conversation) && conversation.length > 0) {
            conversationMessages = conversation.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: [{ text: msg.content }]
            }))
            while (conversationMessages.length > 0 && conversationMessages[0].role !== 'user') {
                conversationMessages.shift()
            }
        }

        const currentQueryMessage = { role: "user", content: [{ text: query }] }
        if (conversationMessages.length > 0 && conversationMessages[conversationMessages.length - 1].role === 'user') {
            conversationMessages[conversationMessages.length - 1].content[0].text += `\n\n${query}`
        } else {
            conversationMessages.push(currentQueryMessage)
        }

        // ── Agentic loop ──────────────────────────────────────────────────
        let iterationCount = 0
        const maxIterations = 5
        const toolCallLog: any[] = []

        while (iterationCount < maxIterations) {
            iterationCount++

            const command = new ConverseCommand({
                modelId: "us.amazon.nova-lite-v1:0",
                system: [{ text: systemPrompt }],
                messages: conversationMessages,
                toolConfig: { tools }
            })

            let response: any
            try {
                response = await client.send(command)
            } catch (bedrockError: any) {
                console.error('[Nova Update Agent] Bedrock Error:', bedrockError)
                return new Response(JSON.stringify({
                    error: 'Failed to call Amazon Bedrock',
                    details: bedrockError.message,
                    code: bedrockError.name
                }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            const stopReason = response.stopReason
            console.log(`[Iteration ${iterationCount}] Stop Reason: ${stopReason}`)

            if (stopReason === "tool_use") {
                const assistantMessage = response.output?.message
                if (!assistantMessage) throw new Error('No assistant message in tool_use response')
                conversationMessages.push(assistantMessage)

                const toolUseBlocks = assistantMessage.content?.filter((c: any) => c.toolUse) || []
                const toolResultContents: any[] = []

                for (const toolUseBlock of toolUseBlocks) {
                    const toolName = toolUseBlock.toolUse.name
                    const toolInput = toolUseBlock.toolUse.input
                    const toolUseId = toolUseBlock.toolUse.toolUseId

                    console.log(`[Nova Update Agent Tool Call] ${toolName}`, JSON.stringify(toolInput, null, 2))

                    let toolResult: any
                    if (toolName === "draft_update_reminder") {
                        toolResult = handleDraftUpdateReminder(toolInput, pinnedReminder, userTags, userPriorities)
                    } else if (toolName === "update_reminder") {
                        toolResult = await handleUpdateReminder(toolInput, userId, supabaseClient, pinnedReminder, userTags, userPriorities)
                    } else if (toolName === "update_notification_offsets") {
                        toolResult = {
                            success: true,
                            offsets: toolInput.offsets,
                            message: "I've drafted the notification change. You can review it above."
                        }
                    } else if (toolName === "create_subtasks") {
                        toolResult = {
                            success: true,
                            subtasks: toolInput.subtasks,
                            message: "Here are the suggested subtasks. You can arrange them or save."
                        }
                    } else if (toolName === "update_subtasks") {
                        toolResult = {
                            success: true,
                            subtasks: toolInput.subtasks,
                            message: "I've added those subtasks for you!"
                        }
                    } else if (toolName === "search_reminders") {
                        toolResult = await handleSearchReminders(toolInput, userId, ADMIN_SECRET_KEY, SUPABASE_URL, supabaseClient)
                    } else if (toolName === "save_context") {
                        toolResult = await handleSaveContext(toolInput, userId, supabaseClient)
                    } else {
                        toolResult = { error: `Unknown tool: ${toolName}` }
                    }

                    toolCallLog.push({ tool: toolName, input: toolInput, result: toolResult, iteration: iterationCount })
                    toolResultContents.push({ toolResult: { toolUseId, content: [{ json: toolResult }] } })
                }

                conversationMessages.push({ role: "user", content: toolResultContents })

            } else if (stopReason === "end_turn") {
                const rawText = response.output?.message?.content?.find((c: any) => c.text)?.text || "Done!"
                const finalText = rawText
                    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '')
                    .replace(/<response>([\s\S]*?)<\/response>/g, '$1')
                    .trim() || "Done!"

                console.log('[Nova Update Agent] Final response:', finalText)

                return new Response(JSON.stringify({
                    message: finalText,
                    tool_calls: toolCallLog,
                    iterations: iterationCount,
                    query
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            } else {
                const text = response.output?.message?.content?.find((c: any) => c.text)?.text || "Something unexpected happened."
                return new Response(JSON.stringify({
                    message: text, tool_calls: toolCallLog, iterations: iterationCount, stopReason
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        return new Response(JSON.stringify({
            error: 'Max iterations reached', tool_calls: toolCallLog, iterations: iterationCount
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        console.error('[Nova Update Agent Error]', error)
        return new Response(JSON.stringify({ error: error.message, details: error.stack }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
