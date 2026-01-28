# Supabase Functions & Migrations

## Overview

This project uses HuggingFace embeddings for AI-powered reminder search instead of OpenAI to keep costs at zero.

**Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)

## Database Schema

### Tables

- **reminders**: Main reminder data (title, date, time, tags, priority, etc.)
- **reminder_embeddings**: Vector embeddings for semantic search
  - Links to reminders via `reminder_id`
  - Stores the `content` (text that was embedded) and `embedding` (384d vector)

### Functions

- **match_reminders**: Vector similarity search function
  - Takes a query embedding and returns similar reminders
  - Filters by user_id for security

## Edge Functions

### 1. `ai-search`
AI-powered reminder search using vector embeddings and Groq LLM.

**Endpoints**: POST `/ai-search`

**Request Body**:
```json
{
  "query": "What reminders do I have for today?"
}
```

**How it works**:
1. Converts user query to embedding using HuggingFace API
2. Searches `reminder_embeddings` using vector similarity
3. Sends results to Groq LLM for natural language response
4. Returns conversational answer + matching reminders

### 2. `generate-embedding`
Generates and stores embeddings for a single reminder. **Note: This function requires user authentication.**

**Endpoints**: POST `/generate-embedding`

**Request Body**:
```json
{
  "reminder_id": "uuid",
  "title": "Buy groceries",
  "tag_name": "Personal" // optional
}
```

**When to call**:
- After creating a new reminder
- After updating a reminder's title or tag

### 3. `admin-generate-embeddings` (Admin Only)
**🔒 Admin-only endpoint for bulk embedding generation**

Generates embeddings for all reminders of a specific user. Uses service role key to bypass RLS - perfect for pro feature rollout.

**Endpoints**: POST `/admin-generate-embeddings`

**Headers Required**:
```
x-admin-secret: your-admin-secret-key
Content-Type: application/json
```

**Request Body**:
```json
{
  "user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"
}
```

**Response**:
```json
{
  "success": true,
  "user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46",
  "total_reminders": 25,
  "embeddings_generated": 23,
  "errors": 2,
  "failed_reminders": [
    {"id": "abc-123", "title": "Example", "error": "HuggingFace rate limit"}
  ],
  "duration_ms": 4500
}
```

**When to use**:
- When a user upgrades to pro tier
- Bulk generation for existing users
- Manual admin control over AI features

**Security**:
- Protected by `ADMIN_SECRET_KEY` environment variable
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- Should only be called by admin via API tools (Postman, cURL)
- Never expose admin secret in client code

## Environment Variables

You need to set these in your Supabase project:

```bash
HF_API_KEY=hf_xxxxxxxxxxxxx        # HuggingFace API key (free tier available)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx    # Groq API key for LLM
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # For admin-generate-embeddings function
ADMIN_SECRET_KEY=xxxxxxxxxxxxx    # Custom secret for admin endpoint protection
```

**Setting environment variables:**

```bash
# Via Supabase CLI
supabase secrets set HF_API_KEY=your-key-here
supabase secrets set GROQ_API_KEY=your-key-here
supabase secrets set ADMIN_SECRET_KEY=your-secret-here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Or via Supabase Dashboard: Settings > Edge Functions > Secrets
```

**Finding your Service Role Key:**
1. Go to Supabase Dashboard
2. Select your project
3. Settings (gear icon) → API
4. Copy the "service_role" key (NOT the anon key)
5. ⚠️ **NEVER expose this in client code** - it bypasses all security

**Generating Admin Secret:**
```bash
# Generate a secure random key
openssl rand -base64 32
```

### Getting API Keys

1. **HuggingFace**: https://huggingface.co/settings/tokens (free tier available)
2. **Groq**: https://console.groq.com/keys (free tier with rate limits)

## Admin Workflow for Pro Features (MVP)

**AI search is a pro feature.** Instead of users generating their own embeddings, you (admin) control who gets AI features:

### 1. User Upgrades to Pro
- User subscribes or you manually flag them as pro in your database
- Note their `user_id` from Supabase Dashboard → Authentication → Users

### 2. Admin Generates Embeddings
Use Postman, cURL, or any API tool:

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/admin-generate-embeddings \
  -H "x-admin-secret: your-admin-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"}'
```

**Postman Setup:**
- Method: POST
- URL: `https://your-project.supabase.co/functions/v1/admin-generate-embeddings`
- Headers:
  - `x-admin-secret`: `<your-admin-secret>`
  - `Content-Type`: `application/json`
- Body (raw JSON):
  ```json
  {"user_id": "430f7602-bf2d-4e41-9e5e-0fc07ca52b46"}
  ```

### 3. User Can Now Use AI Search
- Embeddings are generated for all their reminders
- AI search will work immediately
- No JWT issues since admin used service role key

**Benefits:**
- ✅ No JWT authentication issues
- ✅ Full control over who gets AI features
- ✅ Perfect for pro tier gating
- ✅ Handles all reminders in one API call

## Usage in Your App

### When Creating a Reminder (Standard Flow)

```typescript
// 1. Create the reminder
const { data: reminder, error } = await supabase
  .from('reminders')
  .insert({ title, date, time, tag_id, ... })
  .select()
  .single()

// 2. For pro users, embeddings are already generated
// For new reminders, they'll need to be regenerated via admin endpoint
// OR implement automatic generation via database trigger (see below)
```

### Searching Reminders with AI

```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-search`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "What's on my todo list for tomorrow?"
  })
})

const { answer, evidence, actions } = await response.json()
```

## Database Triggers (Optional)

You can automatically generate embeddings when reminders are created/updated:

```sql
-- Create a function to call the edge function
CREATE OR REPLACE FUNCTION generate_reminder_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue the embedding generation (use pg_net or similar)
  -- This is optional - you can call from your app instead
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER on_reminder_change
  AFTER INSERT OR UPDATE OF title, tag_id ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION generate_reminder_embedding();
```

## Migrations

All migrations are stored in `/supabase/migrations/` and can be applied using:

```bash
# Via Supabase CLI
supabase db push

# Or manually via SQL editor in Supabase dashboard
```

## Deployment

Deploy edge functions:

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy ai-search
supabase functions deploy generate-embedding
supabase functions deploy admin-generate-embeddings

# Set environment variables (required before deployment)
supabase secrets set HF_API_KEY=your-hf-key
supabase secrets set GROQ_API_KEY=your-groq-key
supabase secrets set ADMIN_SECRET_KEY=$(openssl rand -base64 32)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Testing the admin endpoint:**

```bash
# Test locally (if running supabase locally)
curl -X POST http://localhost:54321/functions/v1/admin-generate-embeddings \
  -H "x-admin-secret: your-test-secret" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-user-id"}'

# Test in production
curl -X POST https://your-project.supabase.co/functions/v1/admin-generate-embeddings \
  -H "x-admin-secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "real-user-id"}'
```

## Cost Analysis

- **HuggingFace API**: Free tier (rate limited) or $9/month for Pro
- **Groq API**: Free tier with generous rate limits
- **Supabase**: Free tier includes vector search

**Total monthly cost**: $0 (on free tiers) 🎉

Compare to OpenAI embeddings: ~$0.0001 per 1K tokens = $10+ per month for active users

## Tips

1. **Batch embedding generation**: Generate embeddings for existing reminders in batches
2. **Tag integration**: Include tag names in embeddings for better search ("work reminders", "personal tasks")
3. **Rate limits**: HuggingFace free tier may be slow - consider caching or upgrading for production
4. **Monitoring**: Check edge function logs in Supabase dashboard for errors
