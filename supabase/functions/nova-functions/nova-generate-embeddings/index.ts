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

    const startTime = Date.now()

    try {
        // Get environment variables
        const ADMIN_SECRET_KEY = Deno.env.get('ADMIN_SECRET_KEY')!
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID')
        const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY')
        const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1'

        // Validate AWS credentials
        if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
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

        console.log('[Nova Generate Embeddings] Starting for user:', user_id)

        // Create Supabase client with service role key (bypasses RLS)
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        // Create Bedrock client
        const bedrockClient = new BedrockRuntimeClient({
            region: AWS_REGION,
            credentials: {
                accessKeyId: AWS_ACCESS_KEY_ID,
                secretAccessKey: AWS_SECRET_ACCESS_KEY,
            },
        })

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

        console.log(`[Nova] Found ${reminders.length} reminders for user ${user_id}`)

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

                // Generate embedding using Amazon Titan Embed Text v2
                const invokeCommand = new InvokeModelCommand({
                    modelId: "amazon.titan-embed-text-v2:0",
                    contentType: "application/json",
                    accept: "application/json",
                    body: JSON.stringify({
                        inputText: contentToEmbed,
                        dimensions: 1024,
                        normalize: true
                    })
                })

                const embeddingResponse = await bedrockClient.send(invokeCommand)
                const responseBody = JSON.parse(new TextDecoder().decode(embeddingResponse.body))
                const embeddingVector = responseBody.embedding

                if (!embeddingVector || !Array.isArray(embeddingVector)) {
                    throw new Error(`Invalid embedding response: ${JSON.stringify(responseBody).slice(0, 200)}`)
                }

                console.log(`[Nova] Got ${embeddingVector.length}d embedding for reminder ${reminder.id}`)

                // Upsert into nova_reminder_embeddings table
                const { error: upsertError } = await supabase
                    .from('nova_reminder_embeddings')
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
                console.log(`[Success] Generated Nova embedding for reminder ${reminder.id}`)

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
        console.log(`[Nova] Completed: ${successCount} success, ${errorCount} errors, ${duration}ms`)

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
