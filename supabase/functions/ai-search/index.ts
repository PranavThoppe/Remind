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
    const HF_API_KEY = Deno.env.get('HF_API_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ADMIN_SECRET_KEY = Deno.env.get('ADMIN_SECRET_KEY')!

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
    
    const { query, dev_user_id } = body
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
      console.log('[AI Query] Admin Bypass - Using user:', dev_user_id)
      user = { id: dev_user_id }
      // Use service role key to bypass RLS for admin testing
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

    console.log('[AI Query] User:', user.id, 'Query:', query)

    // Setup dates
    const now = new Date()
    // Important: Use a format that ensures the LLM understands the current context clearly
    const todayStr = now.toISOString().split('T')[0]
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
    const fullToday = `${dayOfWeek}, ${todayStr}`

    // STEP 1 & 2: Run Temporal Analysis and Embedding Generation in Parallel
    const [temporalRes, embeddingRes] = await Promise.all([
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
              1. If the user query refers to a specific date or a relative day (like "tomorrow", "next Friday", "this weekend", "Friday", etc.), you MUST calculate the exact date in YYYY-MM-DD format.
              2. For relative weekdays like "Friday", calculate the date for the CLOSEST occurrence of that day in the future (the very next one).
              3. If today is Wednesday (2026-01-28) and the user says "Friday", the date is 2026-01-30.
              4. If the user says "next [weekday]", it means the weekday in the following week.
              5. Return ONLY the YYYY-MM-DD string.
              6. If absolutely no date or time period is mentioned, return "NONE".
              
              EXAMPLES:
              - Today: Wednesday, 2026-01-28 | Query: "friday" -> "2026-01-30"
              - Today: Wednesday, 2026-01-28 | Query: "tomorrow" -> "2026-01-29"
              - Today: Wednesday, 2026-01-28 | Query: "next friday" -> "2026-02-06"`
            },
            { role: 'user', content: query }
          ],
          temperature: 0,
          max_tokens: 10
        })
      }),
      fetch('https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: query })
      })
    ])

    // Validate Temporal Analysis Response
    if (!temporalRes.ok) {
      const errorData = await temporalRes.json().catch(() => ({}))
      throw new Error(`Groq Temporal Error: ${errorData.error?.message || temporalRes.statusText}`)
    }
    const temporalData = await temporalRes.json()
    const targetDate = temporalData.choices?.[0]?.message?.content?.trim() || 'NONE'
    console.log('[Temporal Analysis] Target Date:', targetDate)

    // Validate Embedding Response
    if (!embeddingRes.ok) {
      const errorData = await embeddingRes.json().catch(() => ({}))
      throw new Error(`HuggingFace Error: ${errorData.error || embeddingRes.statusText}`)
    }
    const embedding = await embeddingRes.json()
    const queryEmbedding = Array.isArray(embedding[0]) ? embedding[0] : embedding

    // STEP 3 & 4: Search Database (Vector and Keyword/Date) in Parallel
    const vectorSearchPromise = supabase.rpc('match_reminders', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, // Lowered from 0.5 to be more inclusive
      match_count: 10,
      p_user_id: user.id
    })

    const keywordSearchPromise = supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .or(`title.ilike.%${query}%`)
      .limit(5)

    const embeddingKeywordSearchPromise = (targetDate !== 'NONE')
      ? supabase
          .from('reminder_embeddings')
          .select('reminder_id, content')
          .eq('user_id', user.id)
          .ilike('content', `%${targetDate}%`)
          .limit(5)
      : Promise.resolve({ data: [] })

    const dateSearchPromise = (targetDate !== 'NONE' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate))
      ? supabase.from('reminders').select('*').eq('user_id', user.id).eq('date', targetDate)
      : Promise.resolve({ data: [] })

    const [vectorRes, keywordRes, dateRes, embedKeywordRes] = await Promise.all([
      vectorSearchPromise,
      keywordSearchPromise,
      dateSearchPromise,
      embeddingKeywordSearchPromise
    ])

    if (vectorRes.error) console.error('[Vector Search Error]', vectorRes.error)
    if (keywordRes.error) console.error('[Keyword Search Error]', keywordRes.error)
    if (dateRes.error) console.error('[Date Search Error]', dateRes.error)
    if ((embedKeywordRes as any).error) console.error('[Embed Keyword Search Error]', (embedKeywordRes as any).error)

    const vectorResults = vectorRes.data || []
    const keywordResults = keywordRes.data || []
    const dateResults = dateRes.data || []
    const embedKeywordResults = (embedKeywordRes as any).data || []

    // Step 5: Combine and deduplicate results
    const allResults = new Map<string, any>()
    
    // Add date matches with high priority
    dateResults.forEach((r: any) => {
      allResults.set(r.id, {
        reminder_id: r.id,
        title: r.title,
        date: r.date,
        time: r.time,
        completed: r.completed,
        source: 'date',
        score: 1.0
      })
    })

    // Add keyword matches from embeddings table
    embedKeywordResults.forEach((r: any) => {
      if (!allResults.has(r.reminder_id)) {
        allResults.set(r.reminder_id, {
          reminder_id: r.reminder_id,
          title: r.content.split('[')[0].trim(), // Rough title extraction
          source: 'keyword_embed',
          score: 0.9
        })
      }
    })

    vectorResults.forEach((r: any) => {
      if (!allResults.has(r.reminder_id)) {
        allResults.set(r.reminder_id, {
          ...r,
          source: 'vector',
          score: r.similarity
        })
      }
    })

    keywordResults.forEach((r: any) => {
      if (!allResults.has(r.id)) {
        allResults.set(r.id, {
          reminder_id: r.id,
          title: r.title,
          date: r.date,
          time: r.time,
          completed: r.completed,
          source: 'keyword',
          score: 0.7
        })
      }
    })

    const topResults = Array.from(allResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    // Step 6: Deterministically filter reminders for target date
    // KEY IMPROVEMENT: We do the "does this reminder exist?" check in CODE, not in the LLM.
    // This eliminates the bug where the LLM says "no reminders" even when reminders exist.
    // The LLM's job is now ONLY to format the list nicely and ask a helpful follow-up question.
    const remindersForTargetDate = (targetDate !== 'NONE' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate))
      ? topResults.filter(r => r.date === targetDate && !r.completed)
      : []

    // Build structured JSON context instead of bullet points
    const remindersJson = remindersForTargetDate.length > 0 
      ? remindersForTargetDate.map(r => ({
          title: r.title,
          date: r.date,
          time: r.time || null,
          completed: r.completed || false
        }))
      : []

    // Also include all top results for general context
    const allRemindersJson = topResults.map(r => ({
      title: r.title,
      date: r.date || null,
      time: r.time || null,
      completed: r.completed || false,
      score: r.score
    }))

    // Step 7: Build answer deterministically when reminders exist for target date
    // This COMPLETELY eliminates the LLM's ability to say "no reminders" when they exist
    let answer: string
    let followUp: string
    let actions: any[] = []

    if (remindersForTargetDate.length > 0) {
      // Case 1: Reminders exist for target date - build answer in code (no LLM needed)
      console.log('[Deterministic Answer] Found', remindersForTargetDate.length, 'reminders for', targetDate)
      
      const list = remindersForTargetDate
        .map(r => r.time ? `${r.title} (${r.time})` : r.title)
        .join(', ')
      
      answer = `${targetDate}: ${list}.`
      followUp = remindersForTargetDate.some(r => !r.time)
        ? "Want me to set a time for any of these or add another reminder?"
        : "Want to add another reminder for that day?"
    } else if (targetDate !== 'NONE' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      // Case 2: No reminders for specific target date - simple response
      console.log('[Deterministic Answer] No reminders for', targetDate)
      answer = `Nothing scheduled for ${targetDate}.`
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

      // Parse JSON response
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

    // Step 8: Return response
    return new Response(
      JSON.stringify({
        answer,
        follow_up: followUp,
        evidence: topResults.map(r => ({
          reminder_id: r.reminder_id,
          title: r.title,
          date: r.date,
          time: r.time,
          score: r.score
        })),
        actions,
        query,
        targetDate: targetDate !== 'NONE' ? targetDate : null,
        reminders_for_target_date: remindersForTargetDate.length // Debug info
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('[Error]', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
