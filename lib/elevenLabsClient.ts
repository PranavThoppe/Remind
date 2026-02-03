
// Tools logic for ElevenLabs Agent
// These functions map the agent's requests to your Supabase Edge Functions

import { supabase } from './supabase';

// Helper to call your admin-bypass functions
const callSupabaseFunction = async (functionName: string, body: any) => {
    // Using x-admin-secret since we removed authentication for MVP
    // You can fetch this from a local env file or hardcode for MVP testing
    const ADMIN_SECRET = process.env.EXPO_PUBLIC_ADMIN_SECRET_KEY || 'your-admin-secret-here';

    const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        headers: {
            'x-admin-secret': ADMIN_SECRET
        }
    });

    if (error) {
        console.error(`[Tool Error] ${functionName} failed:`, error);
        return { error: error.message };
    }

    return data;
};

export const handleClientToolCall = async (toolCall: any, userId?: string): Promise<any> => {
    const { name, parameters } = toolCall;
    console.log(`[Agent Tool] Calling ${name} with:`, parameters);

    const targetUserId = userId || 'mobile-app-user';

    try {
        if (name === 'search_reminders') {
            const result = await callSupabaseFunction('ai-search', {
                query: parameters.query,
                target_date: parameters.target_date,
                dev_user_id: targetUserId
            });

            // Simplify for the agent to speak
            return {
                answer: result.answer,
                follow_up: result.follow_up
            };
        }

        if (name === 'create_reminder') {
            const result = await callSupabaseFunction('ai-extract-test', {
                query: parameters.query,
                dev_user_id: targetUserId
            });

            return {
                message: result.message,
                // Only return critical updates so agent doesn't read full JSON
                confirmation: result.fieldUpdates ? `Set for ${result.fieldUpdates.date || 'someday'} at ${result.fieldUpdates.time || 'anytime'}` : "Reminder details extracted."
            };
        }

        return { error: `Unknown tool: ${name}` };
    } catch (err: any) {
        console.error('[Handler Error]', err);
        return { error: 'Failed to execute tool', details: err.message };
    }
};
