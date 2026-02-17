-- ============================================================
-- Phase 1: Nova Embeddings Database Setup
-- New table + RLS + RPC for Amazon Nova 1024d embeddings
-- Existing reminder_embeddings (HF 384d) stays untouched
-- ============================================================

-- 1. New table for Nova embeddings (1024 dimensions)
CREATE TABLE nova_reminder_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(reminder_id)
);

CREATE INDEX idx_nova_embeddings_user ON nova_reminder_embeddings(user_id);

-- 2. RLS policies
ALTER TABLE nova_reminder_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nova embeddings"
  ON nova_reminder_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage nova embeddings"
  ON nova_reminder_embeddings FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Vector similarity search RPC
CREATE OR REPLACE FUNCTION match_reminders_nova(
  query_embedding VECTOR(1024),
  match_threshold FLOAT,
  match_count INT,
  p_user_id UUID
)
RETURNS TABLE (
  reminder_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ne.reminder_id,
    ne.content,
    1 - (ne.embedding <=> query_embedding) AS similarity
  FROM nova_reminder_embeddings ne
  WHERE ne.user_id = p_user_id
    AND 1 - (ne.embedding <=> query_embedding) > match_threshold
  ORDER BY ne.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
