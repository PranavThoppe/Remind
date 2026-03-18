import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI } from 'npm:@google/genai'

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
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
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
            image, // base64 string
            conversation = [],
            tags = [],
            priorities = []
        } = body

        if (!query && !image) {
            return new Response(JSON.stringify({ error: 'Query or image required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        // Check if user is pro member
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('pro')
            .eq('id', user_id)
            .single()

        if (profileError || !profile || !profile.pro) {
            return new Response(JSON.stringify({
                error: 'This feature requires a Pro membership. Please upgrade to access AI-powered reminder extraction.',
                code: 'PRO_REQUIRED'
            }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Initialize Gemini with GoogleGenAI
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        // Build context
        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        const fullToday = now.toDateString()

        const tagsList = tags.length > 0
            ? tags.map((t: any) => `- ${t.name}`).join('\n')
            : 'No tags available'

        const systemPrompt = `You are a reminder extraction assistant. Today is ${fullToday}.
    
USER'S AVAILABLE TAGS:
${tagsList}

INSTRUCTIONS:
1. Examine the user query AND the provided image (if any).
2. EXTRACT reminder details: title (max 6 words), date (YYYY-MM-DD), time (HH:mm), tag_name (must match an available tag), repeat (none, daily, weekly, monthly).
3. If an image is provided, it might contain a flyer, receipt, or appointment card. Use it as the primary source of truth.
4. If no specific action is found, treat as a "chat" intent. Otherwise "create".

Return ONLY valid JSON:
{
  "type": "create" | "chat" | "search",
  "message": "friendly conversational response (MAX 15 WORDS)",
  "fieldUpdates": {
    "title": "Concise title",
    "date": "YYYY-MM-DD or null",
    "time": "HH:mm or null",
    "tag_name": "One of the available tags or null",
    "repeat": "none" | "daily" | "weekly" | "monthly" | null
  }
}`

        // Construct content parts
        const parts: any[] = [{ text: systemPrompt }];
        if (query) {
            parts.push({ text: query });
        }

        if (image) {
            parts.push({
                inlineData: {
                    data: image,
                    mimeType: "image/jpeg"
                }
            });
        }

        // Generate content using the new API structure
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: parts
        });

        const text = response.text;

        // Clean up potentially wrapped JSON
        const jsonMatch = text?.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : (text || "{}");

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonStr);
        } catch (e) {
            console.error('[Gemini Parse Error]', e, 'Raw:', text);
            throw new Error('Failed to parse Gemini response');
        }

        return new Response(
            JSON.stringify(parsedResponse),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error: any) {
        console.error('[AI Vision Gemini Error]', error)
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
