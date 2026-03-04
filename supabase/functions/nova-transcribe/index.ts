import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
    if (!DEEPGRAM_API_KEY) {
      return new Response(JSON.stringify({ error: 'DEEPGRAM_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return new Response(JSON.stringify({ error: 'No audio file uploaded' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const urlParams = new URLSearchParams()
    urlParams.append('model', 'nova-2')
    urlParams.append('smart_format', 'true')

    const dgResponse = await fetch(`https://api.deepgram.com/v1/listen?${urlParams.toString()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': file.type || 'audio/m4a'
      },
      body: file,
    })

    if (!dgResponse.ok) {
      const errorText = await dgResponse.text()
      console.error('[Nova Transcribe Error] Deepgram Error:', errorText)
      throw new Error(`Deepgram API returned ${dgResponse.status}`)
    }

    const data = await dgResponse.json()
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''

    return new Response(JSON.stringify({ text: transcript.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[Nova Transcribe Error]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
