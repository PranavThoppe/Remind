import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "npm:@aws-sdk/client-bedrock-runtime@3.705.0"

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
        const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID')
        const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY')
        const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1'

        if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
            return new Response(JSON.stringify({ error: 'AWS credentials not configured' }), {
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

        const { query, dev_user_id, target_date, start_date, end_date: input_end_date } = body
        console.log('[Nova Search] Received Request. Query:', query, 'Target Date:', target_date)

        if (!query) {
            return new Response(JSON.stringify({ error: 'Query required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let user;
        let supabase;

        // Check for admin bypass
        const adminSecret = req.headers.get('x-admin-secret')
        if (adminSecret && adminSecret === ADMIN_SECRET_KEY && dev_user_id) {
            console.log('[Nova Search] Admin Bypass - Using user:', dev_user_id)
            user = { id: dev_user_id }
            supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        } else {
            // Standard JWT authentication
            const authHeader = req.headers.get('Authorization')!
            if (!authHeader) {
                return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: authHeader } }
            })

            const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
            if (userError || !authUser) {
                return new Response(JSON.stringify({ error: 'Unauthorized: Invalid JWT' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            user = authUser
        }

        console.log('[Nova Search] User:', user.id, 'Query:', query)

        // Setup dates with comprehensive context
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
        const nextFriday = new Date(now)
        const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7
        nextFriday.setDate(now.getDate() + daysUntilFriday)
        const nextFridayStr = nextFriday.toISOString().split('T')[0]
        const fridayNextWeek = new Date(nextFriday)
        fridayNextWeek.setDate(fridayNextWeek.getDate() + 7)
        const fridayNextWeekStr = fridayNextWeek.toISOString().split('T')[0]

        // Create Bedrock client for Nova embedding
        const bedrockClient = new BedrockRuntimeClient({
            region: AWS_REGION,
            credentials: {
                accessKeyId: AWS_ACCESS_KEY_ID,
                secretAccessKey: AWS_SECRET_ACCESS_KEY,
            },
        })

        // STEP 1 & 2: Run Temporal Analysis and Nova Embedding Generation in Parallel
        const [temporalRes, embeddingResponse] = await Promise.all([
            // Step 1: Groq temporal analysis (unchanged from ai-search)
            fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a date extraction tool. Today is ${fullToday}.

INSTRUCTIONS:
1. Identify if the user query refers to a specific date, a relative day, or a range (like "this week", "this month").
2. Calculate the exact dates in YYYY-MM-DD format.
3. For "this week", return the range from today until the end of the coming Sunday.
4. For "this month", return the range from today until the end of the current month.
5. For relative weekdays like "Friday", calculate the date for the CLOSEST occurrence of that day in the future (the very next one).
6. If the user says "next [weekday]", it means that weekday in the following week (not this week).
7. Return ONLY a JSON object.

EXAMPLES (use today above for your calculation):
- "today" -> startDate: ${todayStr}, endDate: ${todayStr}
- "tomorrow" -> startDate: ${tomorrowStr}, endDate: ${tomorrowStr}
- "friday" or "this friday" (if Friday is upcoming) -> startDate: ${nextFridayStr}, endDate: ${nextFridayStr}
- "next friday" -> startDate: ${fridayNextWeekStr}, endDate: ${fridayNextWeekStr}
- "this week" -> startDate: ${todayStr}, endDate: [Coming Sunday], isRange: true
- "next week" -> startDate: [Next Monday], endDate: [Next Sunday], isRange: true
- "next month" -> startDate: [First Day of Next Month], endDate: [Last Day of Next Month], isRange: true

FORMAT:
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "isRange": boolean,
  "confidence": number (0-1)
}

If no date is mentioned, return startDate: null.`
                        },
                        { role: 'user', content: query }
                    ],
                    temperature: 0,
                    max_tokens: 150,
                    response_format: { type: 'json_object' }
                })
            }),
            // Step 2: Nova embedding via Amazon Bedrock (Titan Embed Text v2, 1024d)
            bedrockClient.send(new InvokeModelCommand({
                modelId: 'amazon.titan-embed-text-v2:0',
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    inputText: query,
                    dimensions: 1024,
                    normalize: true
                })
            }))
        ])

        // Validate Temporal Analysis Response
        if (!temporalRes.ok) {
            const errorData = await temporalRes.json().catch(() => ({}))
            throw new Error(`Groq Temporal Error: ${errorData.error?.message || temporalRes.statusText}`)
        }
        const temporalData = await temporalRes.json()
        const temporalJson = JSON.parse(temporalData.choices?.[0]?.message?.content || '{}')
        console.log('[Temporal Analysis] Extracted:', temporalJson)

        // Robust extraction: prioritize provided target_date, then LLM extraction
        let startDate = temporalJson.startDate
        let endDate = temporalJson.endDate || temporalJson.startDate
        let isRange = temporalJson.isRange || false

        // Priority 1: Explicit range from caller (e.g. from nova-agent)
        if (start_date) {
            console.log('[Temporal Analysis] Overriding with provided range:', start_date, 'to', input_end_date)
            startDate = start_date
            endDate = input_end_date || start_date
            isRange = !!input_end_date && input_end_date !== start_date
        }
        // Priority 2: Legacy single target_date
        else if (target_date && /^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
            console.log('[Temporal Analysis] Overriding with target_date:', target_date)
            startDate = target_date
            endDate = target_date
            isRange = false
        }

        const hasTargetDate = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)

        // Parse Nova embedding response
        const embeddingBody = JSON.parse(new TextDecoder().decode(embeddingResponse.body))
        const queryEmbedding = embeddingBody.embedding

        if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
            throw new Error(`Invalid Nova embedding response: ${JSON.stringify(embeddingBody).slice(0, 200)}`)
        }

        console.log(`[Nova Search] Got ${queryEmbedding.length}d embedding for query`)

        // STEP 3: Dual Strategy
        // A. If we have a specific date (or range), fetch ALL reminders for that period. 
        //    Vector search often fails here because "what do I have today" has low similarity to "Buy Milk".
        // B. Always run vector search for context or if no date is present.

        let remindersForTargetDate: any[] = []
        let topResults: any[] = []

        if (hasTargetDate) {
            console.log(`[Nova Search] Date detected (${startDate} to ${endDate}). Fetching directly from DB.`)
            const { data: dateReminders, error: dateError } = await supabase
                .from('reminders')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('time', { ascending: true })

            if (dateError) {
                console.error('[Date Search Error]', dateError)
            } else {
                remindersForTargetDate = (dateReminders || []).map((r: any) => ({
                    reminder_id: r.id,
                    title: r.title,
                    date: r.date,
                    time: r.time,
                    completed: r.completed,
                    tag_id: r.tag_id,
                    priority_id: r.priority_id,
                    score: 1.0 // Perfect match because it matches the date
                }))
            }
        }

        // Run vector search (always good to have for "hybrid" results or fallback)
        // But we only rely on it if we didn't find date matches, or to mix in relevant stuff
        const { data: searchResults, error: searchError } = await supabase.rpc('match_reminders_nova', {
            query_embedding: queryEmbedding,
            match_threshold: 0.2, // Low threshold
            match_count: 15,
            p_user_id: user.id,
            p_start_date: null, // Don't filter by date in vector search, we handled it separately
            p_end_date: null
        })

        if (searchError) console.error('[Search Error]', searchError)

        topResults = (searchResults || []).map((r: any) => ({
            reminder_id: r.reminder_id,
            title: r.title,
            date: r.date,
            time: r.time,
            completed: r.completed,
            tag_id: r.tag_id,
            priority_id: r.priority_id,
            score: r.similarity
        }))

        // Merge results: standard vector search results are fallback if no date headers
        // But if we have date reminders, they take precedence in the "remindersForTargetDate" bucket


        // Build structured JSON context
        const allRemindersJson = topResults.map(r => ({
            title: r.title,
            date: r.date || null,
            time: r.time || null,
            completed: r.completed || false,
            score: r.score
        }))

        // Step 7: Build answer
        let answer: string
        let followUp: string
        let actions: any[] = []

        if (remindersForTargetDate.length > 0) {
            // Case 1: Reminders exist for target date - build answer in code
            console.log('[Deterministic Answer] Found', remindersForTargetDate.length, 'reminders for', isRange ? `${startDate} to ${endDate}` : startDate)

            const list = remindersForTargetDate
                .map(r => {
                    const status = r.completed ? ' ✅' : ''
                    return r.time ? `${r.title} (${r.time})${status}` : `${r.title}${status}`
                })
                .join(', ')

            answer = isRange
                ? `Reminders from ${startDate} to ${endDate}: ${list}.`
                : `${startDate}: ${list}.`
            followUp = remindersForTargetDate.some(r => !r.time)
                ? "Want me to set a time for any of these or add another reminder?"
                : "Want to add another reminder for that day?"
        } else if (hasTargetDate) {
            // Case 2: No reminders for specific target date/range
            const dateText = isRange ? `between ${startDate} and ${endDate}` : `scheduled for ${startDate}`
            console.log('[Deterministic Answer] No reminders', dateText)
            answer = `Nothing ${dateText}.`
            followUp = "Want me to add a reminder for that day—what should it be and what time?"
        } else {
            // Case 3: General query - use LLM for natural language response
            console.log('[LLM Answer] General query, using LLM for context:', allRemindersJson.length, 'reminders')

            const systemPrompt = `You are a reminders assistant. Today is ${fullToday}.

ALL_RELEVANT_REMINDERS:
${JSON.stringify(allRemindersJson, null, 2)}

INSTRUCTIONS:
- Answer the user's query naturally using the reminders above.
- Be direct and conversational.
- Mention if something is completed if relevant (e.g., "You already finished X").
- Ask ONE helpful follow-up question.
- Do NOT explain date math or reasoning.

OUTPUT FORMAT (return ONLY valid JSON):
{
  "answer": "string - natural answer to the query",
  "follow_up": "string - one short helpful question",
  "actions": [] // optional, for create/update/delete intents
}`

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
                throw new Error(`Groq Answer Error: ${errorData.error?.message || groqRes.statusText}`)
            }

            const groqData = await groqRes.json()
            const rawAnswer = groqData.choices?.[0]?.message?.content || "{}"

            let parsedResponse: { answer?: string; follow_up?: string; actions?: any[] } = {}
            try {
                parsedResponse = JSON.parse(rawAnswer)
            } catch (e) {
                console.log('[JSON Parse Error]', e, 'Raw:', rawAnswer)
                parsedResponse = {
                    answer: rawAnswer,
                    follow_up: "Anything else I can help you with?"
                }
            }

            answer = parsedResponse.answer || "I'm sorry, I couldn't generate an answer."
            followUp = parsedResponse.follow_up || "Anything else I can help you with?"
            actions = parsedResponse.actions || []
        }

        // Step 8: Return response (identical shape to ai-search)
        const evidence = remindersForTargetDate.length > 0
            ? remindersForTargetDate
            : topResults;

        return new Response(
            JSON.stringify({
                answer,
                follow_up: followUp,
                evidence: evidence.map(r => ({
                    reminder_id: r.reminder_id,
                    title: r.title,
                    date: r.date,
                    time: r.time,
                    completed: r.completed,
                    tag_id: r.tag_id,
                    priority_id: r.priority_id,
                    score: r.score
                })),
                actions,
                query,
                targetDate: startDate || null,
                endDate: isRange ? endDate : null,
                reminders_for_target_date: remindersForTargetDate.length
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error: any) {
        console.error('[Nova Search Error]', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
