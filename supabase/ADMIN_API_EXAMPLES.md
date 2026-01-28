# Admin API Examples

## Admin Generate Embeddings Endpoint

This document provides detailed examples for calling the admin-only embedding generation endpoint.

---

## Prerequisites

Before using the admin endpoint, you need:

1. **Admin Secret Key** - Set in Supabase environment variables
2. **Service Role Key** - Get from Supabase Dashboard → Settings → API
3. **User ID** - Get from Supabase Dashboard → Authentication → Users

---

## Getting Your Keys

### 1. Service Role Key

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click Settings (gear icon) → API
4. Under "Project API keys", find **service_role**
5. Click to reveal and copy
6. ⚠️ **NEVER expose this key in client code!**

### 2. Admin Secret Key

Generate a secure random key:

```bash
# On Mac/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Example output:
# 8kJ9mL2nP5qR7sT0vW3xY6zA1bC4dE8fG
```

### 3. Set Environment Variables

```bash
# Via Supabase CLI
supabase secrets set ADMIN_SECRET_KEY=your-generated-secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Or via Supabase Dashboard:
# Settings → Edge Functions → Secrets → Add new secret
```

### 4. Get User ID

1. Go to Supabase Dashboard → Authentication → Users
2. Click on the user you want to generate embeddings for
3. Copy their UUID (e.g., `430f7602-bf2d-4e41-9e5e-0fc07ca52b46`)

---

## cURL Examples

### Basic Request

```bash
curl -X POST \
  https://wnucyciacxqrbuthymbu.supabase.co/functions/v1/admin-generate-embeddings \
  -H "x-admin-secret: your-admin-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"}'
```

### Pretty-Printed Response

```bash
curl -X POST \
  https://wnucyciacxqrbuthymbu.supabase.co/functions/v1/admin-generate-embeddings \
  -H "x-admin-secret: your-admin-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"}' \
  | jq '.'
```

### Verbose Output (for debugging)

```bash
curl -v -X POST \
  https://wnucyciacxqrbuthymbu.supabase.co/functions/v1/admin-generate-embeddings \
  -H "x-admin-secret: your-admin-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"}'
```

---

## Postman Setup

### Step 1: Create New Request

1. Open Postman
2. Click "New" → "HTTP Request"
3. Name it: "Admin Generate Embeddings"

### Step 2: Configure Request

**Method:** `POST`

**URL:**
```
https://wnucyciacxqrbuthymbu.supabase.co/functions/v1/admin-generate-embeddings
```

**Headers:**
- Key: `x-admin-secret` | Value: `your-admin-secret-key`
- Key: `Content-Type` | Value: `application/json`

**Body:**
- Select "raw"
- Choose "JSON" from dropdown
- Paste:

```json
{
  "user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"
}
```

### Step 3: Send Request

Click "Send" and wait for response (may take 5-30 seconds depending on number of reminders)

### Step 4: Save as Collection

1. Save to a collection named "Supabase Admin APIs"
2. Use Postman environment variables for secrets:
   - `{{ADMIN_SECRET}}` for the admin secret
   - `{{SUPABASE_URL}}` for the base URL

---

## Insomnia Setup

### Create New Request

1. Open Insomnia
2. New Request → POST
3. Name: "Admin Generate Embeddings"

**URL:**
```
https://wnucyciacxqrbuthymbu.supabase.co/functions/v1/admin-generate-embeddings
```

**Headers:**
```json
{
  "x-admin-secret": "your-admin-secret-key",
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"
}
```

---

## Response Examples

### Success Response

```json
{
  "success": true,
  "user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46",
  "total_reminders": 25,
  "embeddings_generated": 25,
  "errors": 0,
  "failed_reminders": [],
  "duration_ms": 4523
}
```

### Partial Success (Some Failures)

```json
{
  "success": true,
  "user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46",
  "total_reminders": 25,
  "embeddings_generated": 23,
  "errors": 2,
  "failed_reminders": [
    {
      "id": "abc-123-def-456",
      "title": "Buy groceries",
      "error": "HuggingFace Error: Model is currently loading"
    },
    {
      "id": "xyz-789-ghi-012",
      "title": "Call dentist",
      "error": "HuggingFace Error: Rate limit exceeded"
    }
  ],
  "duration_ms": 4523
}
```

### No Reminders Found

```json
{
  "success": true,
  "user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46",
  "total_reminders": 0,
  "embeddings_generated": 0,
  "errors": 0,
  "message": "No reminders found for this user",
  "duration_ms": 125
}
```

### Error: Unauthorized

```json
{
  "error": "Unauthorized: Invalid admin secret",
  "duration_ms": 2
}
```

### Error: Missing User ID

```json
{
  "error": "user_id required",
  "duration_ms": 1
}
```

---

## Common Issues & Solutions

### Issue: "Unauthorized: Invalid admin secret"

**Solution:**
- Check that `ADMIN_SECRET_KEY` is set in Supabase edge function secrets
- Verify the header name is `x-admin-secret` (lowercase, with dash)
- Ensure the secret matches exactly (no extra spaces)

### Issue: "Failed to fetch reminders"

**Solution:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check that the service role key is the correct one (not anon key)
- Ensure the user_id exists in your database

### Issue: "HuggingFace Error: Model is currently loading"

**Solution:**
- Wait 20-30 seconds and retry
- HuggingFace free tier "cold starts" models
- First request may fail, second should work

### Issue: "HuggingFace Error: Rate limit exceeded"

**Solution:**
- Wait a few minutes before retrying
- HuggingFace free tier has rate limits
- Consider upgrading to HuggingFace Pro ($9/month)
- Implement retry logic with exponential backoff

---

## Production Workflow

### When User Upgrades to Pro

1. **Get notification** (email, webhook, etc.)
2. **Copy user_id** from your database or Supabase dashboard
3. **Call admin endpoint** via Postman/cURL:

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/admin-generate-embeddings \
  -H "x-admin-secret: ${ADMIN_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\"}"
```

4. **Verify response** shows successful generation
5. **User can now use AI search** immediately

### Bulk Processing Multiple Users

```bash
#!/bin/bash
# bulk-generate.sh

ADMIN_SECRET="your-admin-secret"
SUPABASE_URL="https://your-project.supabase.co"

# Array of user IDs
USER_IDS=(
  "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"
  "550a8713-ca3e-5b52-0a6f-1ed18db63c57"
  "660b9824-db4f-6c63-1b70-2fe29ec74d68"
)

for user_id in "${USER_IDS[@]}"; do
  echo "Processing user: $user_id"
  
  curl -X POST \
    "$SUPABASE_URL/functions/v1/admin-generate-embeddings" \
    -H "x-admin-secret: $ADMIN_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\": \"$user_id\"}"
  
  echo -e "\n---\n"
  sleep 2  # Prevent rate limiting
done
```

Make it executable:
```bash
chmod +x bulk-generate.sh
./bulk-generate.sh
```

---

## Security Best Practices

1. **Never commit secrets to git**
   - Add to `.gitignore`: `*.env`, `secrets.txt`, etc.
   - Use environment variables or secret managers

2. **Rotate admin secret periodically**
   ```bash
   supabase secrets set ADMIN_SECRET_KEY=$(openssl rand -base64 32)
   ```

3. **Monitor usage**
   - Check Supabase logs: Edge Functions → Logs
   - Set up alerts for unusual activity

4. **Limit access**
   - Only share admin secret with authorized team members
   - Use separate secrets for dev/staging/prod

5. **Audit trail**
   - Log all admin API calls with timestamps
   - Track which users received embeddings and when

---

## Testing Locally

If running Supabase locally:

```bash
# Start Supabase local
supabase start

# Deploy function locally
supabase functions serve admin-generate-embeddings

# Test with local URL
curl -X POST \
  http://localhost:54321/functions/v1/admin-generate-embeddings \
  -H "x-admin-secret: test-secret" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "local-test-user-id"}'
```

---

## Next Steps

1. ✅ Deploy the function: `supabase functions deploy admin-generate-embeddings`
2. ✅ Set environment variables in Supabase dashboard
3. ✅ Test with a real user ID
4. ✅ Integrate into your pro user upgrade workflow
5. 🚀 Scale AI features to all pro users!

---

**Questions?** Check the [main README](./README.md) or Supabase documentation.
