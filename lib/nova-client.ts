
import { ChatMessage, ModalFieldUpdates } from '../types/ai-chat';
import { Tag, PriorityLevel } from '../types/settings';

const SUPABASE_URL = 'https://wnucyciacxqrbuthymbu.supabase.co';
// MVP MODE: Admin secret for bypassing JWT
const ADMIN_SECRET_KEY = 'bxWLD2nOAFTjbFxlG60jNmNn+djE+DgNpcLlfckyKNw=';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudWN5Y2lhY3hxcmJ1dGh5bWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIzMzgsImV4cCI6MjA4NDQzODMzOH0.Xm5XfWgrQIGpvUzoCUqRntuO0pNXWfb4u465VxUe22Y';

export interface NovaAgentResponse {
    message: string;
    tool_calls: {
        tool: string;
        input: any;
        result: any;
        iteration: number;
    }[];
    iterations: number;
}

export interface CallNovaAgentParams {
    query: string;
    user_id: string;
    conversation?: ChatMessage[];
    client_date?: string; // YYYY-MM-DD
}

/**
 * Calls the nova-agent edge function
 */
export async function callNovaAgent(
    params: CallNovaAgentParams
): Promise<NovaAgentResponse> {
    const { query, user_id, client_date } = params;

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for agent

    try {
        console.log(`[Nova Client] Sending request to: ${SUPABASE_URL}/functions/v1/nova-agent`);

        // Call edge function - MVP mode using service role key + admin secret
        const response = await fetch(`${SUPABASE_URL}/functions/v1/nova-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`,
                'x-admin-secret': ADMIN_SECRET_KEY,
            },
            body: JSON.stringify({
                query,
                user_id,
                client_date,
                conversation: params.conversation?.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Nova Client] HTTP Error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[Nova Client] Success data:', JSON.stringify(data, null, 2));

        return data;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('[Nova Client] Request timed out');
            throw new Error('Request timed out. Please try again.');
        }
        console.error('[Nova Client] Error:', error);
        throw error;
    }
}
