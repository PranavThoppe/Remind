import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Revoke Apple tokens using the authorization code from the client.
// Apple requires this when a user deletes their account (App Store guideline 5.1.1(v)).
async function revokeAppleTokens(authorizationCode: string): Promise<void> {
    const clientId = Deno.env.get('APPLE_SERVICE_ID')
    const clientSecret = Deno.env.get('APPLE_PRIVATE_KEY')

    if (!clientId || !clientSecret) {
        console.warn('[delete-user] Apple credentials not configured, skipping token revocation');
        return;
    }

    const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
        const tokenError = await tokenResponse.text();
        console.warn(`[delete-user] Apple token exchange failed (non-fatal): ${tokenError}`);
        return;
    }

    const tokenData = await tokenResponse.json();
    const refreshToken: string | undefined = tokenData.refresh_token;

    if (!refreshToken) {
        console.warn('[delete-user] No refresh token returned from Apple, skipping revocation');
        return;
    }

    const revokeParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: 'refresh_token',
    });

    const revokeResponse = await fetch('https://appleid.apple.com/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: revokeParams.toString(),
    });

    if (revokeResponse.ok) {
        console.log('[delete-user] Apple tokens revoked successfully');
    } else {
        const revokeError = await revokeResponse.text();
        console.warn(`[delete-user] Apple token revocation failed (non-fatal): ${revokeError}`);
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log('[delete-user] Function invoked');

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        // 1. Extract the raw JWT from the Authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
        const jwt = authHeader.replace('Bearer ', '')

        // 2. Admin client — used for both user verification and deletion
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // 3. Verify the JWT and extract the user ID using the admin client.
        // adminClient.auth.getUser(jwt) validates the token server-side without
        // needing a separate anon-key client, avoiding the gateway JWT issue.
        const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt)

        if (userError || !user) {
            console.error('[delete-user] Token verification failed:', userError?.message || 'No user found');
            return new Response(JSON.stringify({ error: 'Invalid user token', details: userError?.message }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const userId = user.id
        console.log(`[delete-user] Verified user: ${userId}`);

        // 4. Parse request body for optional Apple authorization code
        let appleAuthorizationCode: string | undefined;
        try {
            const body = await req.json();
            appleAuthorizationCode = body?.appleAuthorizationCode;
        } catch {
            // No body or non-JSON body is fine
        }

        // 5. Delete profile row
        console.log(`[delete-user] Deleting profile for user: ${userId}`);
        const { error: profileError } = await adminClient
            .from('profiles')
            .delete()
            .eq('id', userId)

        if (profileError) {
            console.warn(`[delete-user] Warning deleting profile (non-fatal): ${profileError.message}`);
        }

        // 6. Delete auth.users row — this is the authoritative deletion
        console.log(`[delete-user] Deleting auth user: ${userId}`);
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

        if (deleteError) {
            console.error(`[delete-user] Failed to delete auth user: ${deleteError.message}`);
            throw new Error(`Failed to delete user: ${deleteError.message}`);
        }

        console.log(`[delete-user] Successfully deleted user: ${userId}`);

        // 7. Revoke Apple tokens after deletion so a failure here never blocks account removal
        if (appleAuthorizationCode) {
            await revokeAppleTokens(appleAuthorizationCode);
        }

        return new Response(JSON.stringify({ message: 'User deleted successfully', userId }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[delete-user] Unexpected error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
