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

  const startTime = Date.now()

  try {
    // Get environment variables
    const ADMIN_SECRET_KEY = Deno.env.get('ADMIN_SECRET_KEY')!
    const HF_API_KEY = Deno.env.get('HF_API_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify admin secret
    const adminSecret = req.headers.get('x-admin-secret')
    if (!adminSecret || adminSecret !== ADMIN_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid admin secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { user_id } = body
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[Admin Generate Embeddings] Starting for user:', user_id)

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch all reminders for this user with tags
    const { data: reminders, error: fetchError } = await supabase
      .from('reminders')
      .select(`
        id,
        title,
        date,
        time,
        tag_id,
        tags (
          name
        )
      `)
      .eq('user_id', user_id)

    if (fetchError) {
      console.error('[Fetch Error]', fetchError)
      throw new Error(`Failed to fetch reminders: ${fetchError.message}`)
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          user_id,
          total_reminders: 0,
          embeddings_generated: 0,
          errors: 0,
          message: 'No reminders found for this user',
          duration_ms: Date.now() - startTime
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[Admin] Found ${reminders.length} reminders for user ${user_id}`)

    // Track results
    let successCount = 0
    let errorCount = 0
    const failedReminders: Array<{ id: string; title: string; error: string }> = []

    // Process each reminder
    for (const reminder of reminders) {
      try {
        // Create text to embed (include tag and date if available)
        const tagName = (reminder as any).tags?.name
        let contentToEmbed = reminder.title
        if (tagName) contentToEmbed += ` [Tag: ${tagName}]`
        if (reminder.date) contentToEmbed += ` [Date: ${reminder.date}]`
        if (reminder.time) contentToEmbed += ` [Time: ${reminder.time}]`

        console.log(`[Processing] Reminder ${reminder.id}: "${contentToEmbed}"`)

        // Generate embedding using HuggingFace
        const embeddingRes = await fetch(
          'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HF_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: contentToEmbed })
          }
        )

        if (!embeddingRes.ok) {
          const errorData = await embeddingRes.json().catch(() => ({}))
          throw new Error(`HuggingFace Error: ${errorData.error || embeddingRes.statusText}`)
        }

        const embedding = await embeddingRes.json()
        const embeddingVector = Array.isArray(embedding[0]) ? embedding[0] : embedding

        // Upsert into reminder_embeddings table
        const { error: upsertError } = await supabase
          .from('reminder_embeddings')
          .upsert({
            reminder_id: reminder.id,
            user_id: user_id,
            content: contentToEmbed,
            embedding: embeddingVector,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'reminder_id'
          })

        if (upsertError) {
          console.error(`[Upsert Error] Reminder ${reminder.id}:`, upsertError)
          throw upsertError
        }

        successCount++
        console.log(`[Success] Generated embedding for reminder ${reminder.id}`)

      } catch (error: any) {
        errorCount++
        const errorMessage = error.message || 'Unknown error'
        console.error(`[Error] Failed for reminder ${reminder.id}:`, errorMessage)
        failedReminders.push({
          id: reminder.id,
          title: reminder.title,
          error: errorMessage
        })
      }
    }

    const duration = Date.now() - startTime
    console.log(`[Admin] Completed: ${successCount} success, ${errorCount} errors, ${duration}ms`)

    // Return detailed summary
    return new Response(
      JSON.stringify({
        success: true,
        user_id,
        total_reminders: reminders.length,
        embeddings_generated: successCount,
        errors: errorCount,
        failed_reminders: failedReminders,
        duration_ms: duration
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('[Fatal Error]', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        duration_ms: Date.now() - startTime
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
