import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Revoke Apple tokens using the authorization code from the client.
// Apple requires this when a user deletes their account (App Store guideline 5.1.1(v)).
// We use the pre-generated client secret JWT stored as APPLE_PRIVATE_KEY.
async function revokeAppleTokens(authorizationCode: string): Promise<void> {
    const clientId = Deno.env.get('APPLE_SERVICE_ID')
    const clientSecret = Deno.env.get('APPLE_PRIVATE_KEY')

    if (!clientId || !clientSecret) {
        console.warn('[delete-user] Apple credentials not configured, skipping token revocation');
        return;
    }

    // Step 1: Exchange the authorization code for a refresh token
    console.log('[delete-user] Exchanging Apple authorization code for refresh token...');
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

    // Step 2: Revoke the refresh token
    console.log('[delete-user] Revoking Apple refresh token...');
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
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log('[delete-user] Function invoked');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        // 1. Get the JWT from Authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            console.error('[delete-user] No authorization header found');
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log('[delete-user] Authorization header present, verifying token...');

        // 2. Initialize a client with the user's JWT to verify them
        const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: userError } = await userClient.auth.getUser()

        if (userError || !user) {
            console.error('[delete-user] Token verification failed:', userError?.message || 'No user found');
            return new Response(JSON.stringify({ error: 'Invalid user token', details: userError?.message }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const userId = user.id
        console.log(`[delete-user] Token verified for user: ${userId}`);

        // 3. Parse request body for optional Apple authorization code
        let appleAuthorizationCode: string | undefined;
        try {
            const body = await req.json();
            appleAuthorizationCode = body?.appleAuthorizationCode;
        } catch {
            // No body or non-JSON body is fine
        }

        // 4. Initialize Admin client to perform deletion
        console.log('[delete-user] Initializing Admin client...');
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // 5. Delete user data from public.profiles
        console.log(`[delete-user] Deleting profile for user: ${userId}...`);
        const { error: profileError } = await adminClient
            .from('profiles')
            .delete()
            .eq('id', userId)

        if (profileError) {
            console.warn(`[delete-user] Warning deleting profile: ${profileError.message}`);
        } else {
            console.log(`[delete-user] Profile deleted successfully for user: ${userId}`);
        }

        // 6. Delete user from auth.users
        console.log(`[delete-user] Deleting user from auth.users: ${userId}...`);
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

        if (deleteError) {
            console.error(`[delete-user] Error deleting user from auth: ${deleteError.message}`);
            throw new Error(`Failed to delete user from auth: ${deleteError.message}`);
        }

        console.log(`[delete-user] Successfully deleted user: ${userId}`);

        // 7. Revoke Apple tokens if an authorization code was provided.
        // This is done after deletion so a failure here doesn't block account removal.
        if (appleAuthorizationCode) {
            console.log('[delete-user] Apple authorization code present, revoking tokens...');
            await revokeAppleTokens(appleAuthorizationCode);
        }

        return new Response(JSON.stringify({ 
            message: 'User deleted successfully',
            userId: userId
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[delete-user] Unexpected Error:', error);
        return new Response(JSON.stringify({ 
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
