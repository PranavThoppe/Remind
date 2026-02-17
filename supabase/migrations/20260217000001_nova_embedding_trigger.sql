-- ============================================================
-- Auto-generate Nova embeddings on reminder INSERT/UPDATE
-- Uses pg_net to call the nova-embed-single edge function
-- ============================================================

-- Enable pg_net extension (may already be enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: fires on INSERT or UPDATE of reminders
CREATE OR REPLACE FUNCTION generate_nova_embedding_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tag_name TEXT;
  _supabase_url TEXT := 'https://wnucyciacxqrbuthymbu.supabase.co';
BEGIN
  -- Look up tag name if tag_id is set
  IF NEW.tag_id IS NOT NULL THEN
    SELECT name INTO _tag_name FROM tags WHERE id = NEW.tag_id;
  END IF;

  -- Call nova-embed-single edge function via pg_net (async, non-blocking)
  -- Function deployed with --no-verify-jwt, authenticates to DB using its own service role env var
  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/nova-embed-single',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'reminder_id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'date', NEW.date,
      'time', NEW.time,
      'tag_name', _tag_name
    )
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_reminder_upsert_nova_embed ON reminders;

CREATE TRIGGER on_reminder_upsert_nova_embed
  AFTER INSERT OR UPDATE OF title, tag_id, date, time
  ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION generate_nova_embedding_trigger();
