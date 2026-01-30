import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ADMIN_SECRET_KEY = Deno.env.get('ADMIN_SECRET_KEY')!

    // Verify admin secret (MVP mode - bypasses JWT requirement)
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

    const {
      query,
      user_id,
      conversation = [],
      modalContext,
      tags = [],
      priorities = [],
      dev_user_id
    } = body

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // MVP MODE: Use user_id from body (admin secret already verified)
    const targetUserId = user_id || dev_user_id;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const user = { id: targetUserId }

    // Check if user is pro member
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('pro')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[AI Extract Test] Profile fetch error:', profileError)
      return new Response(JSON.stringify({
        error: 'Failed to verify pro status',
        details: profileError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!profile || !profile.pro) {
      return new Response(JSON.stringify({
        error: 'This feature requires a Pro membership. Please upgrade to access AI-powered reminder extraction.',
        code: 'PRO_REQUIRED'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[AI Extract Test] User:', user.id, 'Pro:', profile.pro, 'Query:', query)

    // Setup dates with comprehensive context
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
    const dayOfWeekShort = now.toLocaleDateString('en-US', { weekday: 'short' })
    const monthName = now.toLocaleDateString('en-US', { month: 'long' })
    const dayOfMonth = now.getDate()
    const year = now.getFullYear()
    const fullToday = `${dayOfWeek}, ${monthName} ${dayOfMonth}, ${year} (${todayStr})`

    // Calculate some reference dates for examples
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Calculate next Sunday for example
    const nextSunday = new Date(now)
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7
    nextSunday.setDate(now.getDate() + daysUntilSunday)
    const nextSundayStr = nextSunday.toISOString().split('T')[0]

    // Calculate next week (7 days from now)
    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekStr = nextWeek.toISOString().split('T')[0]

    // Build conversation history string
    const conversationHistory = conversation.length > 0
      ? conversation.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
      : 'No previous conversation'

    // Build tags list
    const tagsList = tags.length > 0
      ? tags.map(t => `- ${t.name} (${t.color})`).join('\n')
      : 'No tags available'

    // Build priorities list
    const prioritiesList = priorities.length > 0
      ? priorities.map(p => `- ${p.name} (Rank: ${p.rank}, Color: ${p.color})`).join('\n')
      : 'No priorities available'

    // Determine intent: create, update, search, or chat
    const isRefinement = modalContext?.isOpen === true

    // Build the extraction prompt
    const systemPrompt = `You are a reminder extraction assistant. Today is ${fullToday}.

USER'S AVAILABLE TAGS:
${tagsList}

USER'S AVAILABLE PRIORITIES:
${prioritiesList}

CONVERSATION HISTORY (last 5 messages):
${conversationHistory}

CURRENT MODAL STATE:
${modalContext?.isOpen ? JSON.stringify(modalContext.currentFields, null, 2) : 'No modal currently open'}

USER QUERY: "${query}"

INSTRUCTIONS:
1. CLASSIFY the user's intent into one of these types:
   - "create": User wants to set/add a new reminder.
   - "update": User is refining an existing reminder (especially if the modal is open) or changing details of something just discussed.
   - "search": User is asking to find information in their reminders, including future tasks AND past history (e.g., "What's on my list?", "When was the last time I...?", "Did I already...?", "Do I have any meetings?").
   - "chat": General conversation, greetings, or questions that aren't about managing specific reminders.

2. EXTRACTION:
   - If "create" or "update", extract all relevant fields.
   - If "search", extract the "date" if they are asking about a specific time, and "title" if they are asking about a specific topic.
   - For "update", extract the fields the user wants to CHANGE or ADD. If the user mentions a tag that matches an available tag, always extract it even if the modal is already open.

CRITICAL TEMPORAL EXTRACTION RULES:
1. "next Sunday" = the Sunday in the upcoming week (${nextSundayStr} if today is ${dayOfWeek})
2. "this Sunday" = the Sunday in the current week if not past, otherwise next week's Sunday
3. "next week" = exactly 7 days from today (${nextWeekStr})
4. "next [weekday]" = that weekday in the following week (not this week)
5. "this [weekday]" = that weekday in the current week if not past, otherwise next week
6. "tomorrow" = ${tomorrowStr}
7. "today" = ${todayStr}
8. "this weekend" = calculate Saturday and Sunday dates
9. "end of month" = last day of current month
10. Always return dates in YYYY-MM-DD format

SEMANTIC TAG CLASSIFICATION (CRITICAL):
- Evaluate ALL available tags against the user's query using SEMANTIC UNDERSTANDING, not just exact keyword matching.
- Consider whether the reminder's TOPIC or CONTEXT relates to a tag, even if the tag name isn't explicitly mentioned.
- Common semantic patterns:
  * "School" tag: homework, quiz, assignment, exam, study, class, lecture, project deadline, turn in, submit
  * "Home" tag: groceries, cleaning, chores, cooking, family, house maintenance
  * "Internship" tag: work tasks, office, meetings, career-related activities
- If the user explicitly mentions a tag (e.g., "for my internship") OR if the reminder semantically belongs to that category, YOU MUST EXTRACT IT into tag_name.
- Choose ONLY the single tag with the HIGHEST relevance score.
- If NO tag fits semantically, set tag_name to null.
- ALWAYS prioritize semantic relevance over exact keyword matching.

FIELD EXTRACTION:
- title: A very concise (MAX 6 WORDS) action-oriented title. REMOVE words that are redundant with the extracted tag_name. (e.g., if tag is "Internship", title should be "Call apartment people" not "Call internship apartment people").
- date: YYYY-MM-DD format or null
- time: HH:mm format (24-hour) or null (convert "2pm" → "14:00")
- tag_name: One of user's tag names if a good semantic match exists, otherwise null. ALWAYS extract this if a tag is mentioned, even if redundant with title.
- repeat: "none" | "daily" | "weekly" | "monthly" or null

EXAMPLES:
User: "remind me to buy groceries tonight at 7pm"
{
  "type": "create",
  "message": "I've set a reminder to buy groceries tonight.",
  "fieldUpdates": {
    "title": "Buy groceries",
    "tag_name": "Home",
    "date": "2026-01-29",
    "time": "19:00"
  }
}

User: "remind me to turn in my quiz tomorrow"
{
  "type": "create",
  "message": "Reminder set to turn in quiz tomorrow.",
  "fieldUpdates": {
    "title": "Turn in quiz",
    "tag_name": "School",
    "date": "2026-01-30"
  }
}

User: "add a reminder for my internship to call the housing office tomorrow"
{
  "type": "create",
  "message": "Added a reminder to call the housing office.",
  "fieldUpdates": {
    "title": "Call housing office",
    "tag_name": "Internship",
    "date": "2026-01-30"
  }
}

User: "When was the last time I went to the gym?"
{
  "type": "search",
  "message": "Checking your history for gym visits...",
  "fieldUpdates": {
    "title": "gym"
  }
}

Return ONLY valid JSON:
{
  "type": "create" | "update" | "search" | "chat",
  "message": "friendly conversational response (MAX 15 WORDS)",
  "fieldUpdates": {
    "title": "A very concise title (MAX 6 WORDS). Remove redundant words like 'internship' if tag_name is 'Internship'.",
    "date": "YYYY-MM-DD or null",
    "time": "HH:mm or null",
    "tag_name": "One of: ${tags.length > 0 ? tags.map(t => t.name).join(', ') : 'null'} or null",
    "repeat": "none" | "daily" | "weekly" | "monthly" | null
  }
}`

    // Call Groq LLM
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    })

    if (!groqRes.ok) {
      const errorData = await groqRes.json().catch(() => ({}))
      throw new Error(`Groq Extraction Error: ${errorData.error?.message || groqRes.statusText}`)
    }

    const groqData = await groqRes.json()
    const rawResponse = groqData.choices?.[0]?.message?.content || "{}"

    // Parse JSON response
    let parsedResponse: {
      type?: 'create' | 'update' | 'search' | 'chat';
      message?: string;
      fieldUpdates?: {
        title?: string | null;
        date?: string | null;
        time?: string | null;
        tag_name?: string | null;
        repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | null;
      };
    } = {}

    try {
      parsedResponse = JSON.parse(rawResponse)
    } catch (e) {
      console.error('[JSON Parse Error]', e, 'Raw:', rawResponse)
      return new Response(JSON.stringify({
        error: 'Failed to parse LLM response',
        raw: rawResponse
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate and clean fieldUpdates
    const fieldUpdates: any = {}

    if (parsedResponse.fieldUpdates) {
      const updates = parsedResponse.fieldUpdates

      // Clean title
      if (updates.title && typeof updates.title === 'string' && updates.title.trim()) {
        fieldUpdates.title = updates.title.trim()
      }

      // Validate date format
      if (updates.date && typeof updates.date === 'string') {
        const dateStr = updates.date.trim()
        // Check if it's a valid YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const testDate = new Date(dateStr + 'T00:00:00')
          if (!isNaN(testDate.getTime())) {
            fieldUpdates.date = dateStr
          }
        }
      }

      // Validate time format (HH:mm)
      if (updates.time && typeof updates.time === 'string') {
        const timeStr = updates.time.trim()
        // Accept HH:mm or H:mm format
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
          const [hours, minutes] = timeStr.split(':').map(Number)
          if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            fieldUpdates.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
          }
        }
      }

      // Validate tag_name (must match one of user's tags)
      if (updates.tag_name && typeof updates.tag_name === 'string') {
        const tagName = updates.tag_name.trim()
        const matchingTag = tags.find((t: any) => t.name.toLowerCase() === tagName.toLowerCase())
        if (matchingTag) {
          fieldUpdates.tag_name = matchingTag.name // Return canonical name
          if (matchingTag.id) {
            fieldUpdates.tag_id = matchingTag.id // Return ID for database/state update
          }
        }
      }

      // Validate repeat
      if (updates.repeat && ['none', 'daily', 'weekly', 'monthly'].includes(updates.repeat)) {
        fieldUpdates.repeat = updates.repeat
      } else if (updates.repeat === null || updates.repeat === undefined) {
        fieldUpdates.repeat = 'none' // Default
      }
    }

    // Build response
    const response = {
      type: parsedResponse.type || (isRefinement ? 'update' : 'chat'),
      message: parsedResponse.message || (isRefinement
        ? "I've updated the reminder fields."
        : "How can I help you with reminders?"),
      fieldUpdates: Object.keys(fieldUpdates).length > 0 ? fieldUpdates : undefined
    }

    console.log('[AI Extract Test] Response:', JSON.stringify(response, null, 2))

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('[AI Extract Test Error]', error)
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
