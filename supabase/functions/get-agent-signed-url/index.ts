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
        const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
        const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID')
        const ADMIN_SECRET_KEY = Deno.env.get('ADMIN_SECRET_KEY')

        if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
            return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Verify admin secret (Bypasses JWT requirement) - Identical to ai-vision-gemini
        const adminSecret = req.headers.get('x-admin-secret')
        if (!adminSecret || adminSecret !== ADMIN_SECRET_KEY) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid admin secret' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Call ElevenLabs to get signed URL
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`, {
            method: 'GET',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY
            }
        })

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error('ElevenLabs API Error:', errorBody);
            return new Response(JSON.stringify({
                error: 'ElevenLabs API Error',
                details: errorBody,
                status: response.status
            }), {
                status: response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const data = await response.json()
        return new Response(JSON.stringify({ signed_url: data.signed_url }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[Get Agent Signed URL Error]', error)
        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error',
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
