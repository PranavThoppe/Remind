import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "npm:@aws-sdk/client-bedrock-runtime@3.705.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Build a natural-language content string for embedding
// "Buy groceries on Tuesday February 18 2026 at 7pm [Work]"
function buildContentString(reminder: {
    title: string,
    date?: string | null,
    time?: string | null,
    tagName?: string | null
}): string {
    let content = reminder.title

    if (reminder.date) {
        const d = new Date(reminder.date + 'T12:00:00Z') // noon UTC avoids timezone shift
        const natural = d.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        })
        content += ` on ${natural}`
    }

    if (reminder.time) {
        const [h, m] = reminder.time.split(':').map(Number)
        const suffix = h >= 12 ? 'pm' : 'am'
        const hour = h % 12 || 12
        const mins = m > 0 ? `:${String(m).padStart(2, '0')}` : ''
        content += ` at ${hour}${mins}${suffix}`
    }

    if (reminder.tagName) content += ` [${reminder.tagName}]`

    return content
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID')
        const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY')
        const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1'

        if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
            return new Response(JSON.stringify({ error: 'AWS credentials not configured' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const body = await req.json()
        const { reminder_id, user_id, title, date, time, tag_name } = body

        if (!reminder_id || !user_id || !title) {
            return new Response(JSON.stringify({ error: 'reminder_id, user_id, and title are required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Build natural-language content string
        const contentToEmbed = buildContentString({
            title,
            date,
            time,
            tagName: tag_name
        })

        console.log(`[Nova Embed Single] Reminder ${reminder_id}: "${contentToEmbed}"`)

        // Generate embedding via Titan Embed v2
        const bedrockClient = new BedrockRuntimeClient({
            region: AWS_REGION,
            credentials: {
                accessKeyId: AWS_ACCESS_KEY_ID,
                secretAccessKey: AWS_SECRET_ACCESS_KEY,
            },
        })

        const embeddingResponse = await bedrockClient.send(new InvokeModelCommand({
            modelId: "amazon.titan-embed-text-v2:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                inputText: contentToEmbed,
                dimensions: 1024,
                normalize: true
            })
        }))

        const responseBody = JSON.parse(new TextDecoder().decode(embeddingResponse.body))
        const embeddingVector = responseBody.embedding

        if (!embeddingVector || !Array.isArray(embeddingVector)) {
            throw new Error(`Invalid embedding response`)
        }

        // Upsert into nova_reminder_embeddings
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        const { error: upsertError } = await supabase
            .from('nova_reminder_embeddings')
            .upsert({
                reminder_id,
                user_id,
                content: contentToEmbed,
                date: date ?? null,
                embedding: embeddingVector,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'reminder_id'
            })

        if (upsertError) {
            throw upsertError
        }

        console.log(`[Nova Embed Single] Success for reminder ${reminder_id}`)

        return new Response(
            JSON.stringify({ success: true, reminder_id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[Nova Embed Single Error]', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
