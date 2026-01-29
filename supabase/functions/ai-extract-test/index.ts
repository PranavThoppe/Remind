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

    // Determine intent: create, update, or chat
    const isRefinement = modalContext?.isOpen === true
    const hasCreationIntent = /(create|add|remind|new reminder|set a reminder|make a reminder)/i.test(query)

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
${isRefinement 
  ? `The user is REFINING an existing reminder. Extract only the fields they want to UPDATE. Leave unchanged fields as null.`
  : hasCreationIntent
  ? `The user wants to CREATE a new reminder. Extract all relevant fields.`
  : `The user is chatting. Extract fields if mentioned, but this may be a general conversation.`
}

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

SEMANTIC TAG CLASSIFICATION:
- Evaluate ALL available tags against the user's query and overall context (conversation + modal state).
- Consider semantic meaning, user intent, and relevance, not just exact keywords.
- Mentally assign each tag a relevance score from 0–100 based on how well it fits this specific reminder.
- Choose ONLY the single tag with the HIGHEST relevance score, but ONLY if its score is >= 50.
- If NO tag has relevance >= 50, set tag_name to null (no tag is appropriate for this reminder).
- If multiple tags could fit, choose the most specific / most natural category for this reminder.
- Example mappings (if such tags exist for the user):
  - "exam", "quiz", "midterm", "final", "homework", "assignment", "class", "lecture", "study" → School tag.
  - "doctor", "dentist", "appointment", "meds", "medicine", "workout", "gym", "exercise" → Health tag.
  - "meeting", "deadline", "project", "client", "sprint", "standup", "conference" → Work tag.
  - "groceries", "shopping", "errands", "buy milk", "pick up package" → Personal / Errands tag.

FIELD EXTRACTION:
- title: Clean reminder title (remove trigger words like "create", "remind me to", "set a reminder", etc.)
- date: YYYY-MM-DD format or null (must be valid date string)
- time: HH:mm format (24-hour) or null (convert "2pm" → "14:00", "3:30am" → "03:30")
- tag_name: One of user's tag names from the list above if a good semantic match exists, otherwise null
- repeat: "none" | "daily" | "weekly" | "monthly" or null
- NOTE: Do NOT extract priority - users set priority manually

EXAMPLES:
Today: ${fullToday}
- Query: "Create reminder for exam next Sunday at 2pm"
  → {title: "exam", date: "${nextSundayStr}", time: "14:00", tag_name: "School", repeat: "none"}
- Query: "Remind me to call mom tomorrow"
  → {title: "call mom", date: "${tomorrowStr}", time: null, tag_name: null, repeat: "none"}
- Query: "next week Friday at 3pm"
  → {title: null, date: "[calculate Friday in next week]", time: "15:00", tag_name: null, repeat: "none"}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "type": "${isRefinement ? 'update' : hasCreationIntent ? 'create' : 'chat'}",
  "message": "friendly conversational response (1-2 sentences)",
  "fieldUpdates": {
    "title": "string or null",
    "date": "YYYY-MM-DD or null",
    "time": "HH:mm or null",
    "tag_name": "string or null",
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
      type?: 'create' | 'update' | 'chat';
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
        const matchingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase())
        if (matchingTag) {
          fieldUpdates.tag_name = matchingTag.name // Return canonical name
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
      type: parsedResponse.type || (isRefinement ? 'update' : hasCreationIntent ? 'create' : 'chat'),
      message: parsedResponse.message || (isRefinement 
        ? "I've updated the reminder fields."
        : hasCreationIntent
        ? "I'll help you create that reminder."
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
