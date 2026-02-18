-- ============================================================
-- Phase 3: Enrich vector search to be self-sufficient
-- 1. Add date column to nova_reminder_embeddings
-- 2. Update match_reminders_nova RPC with date pre-filter
--    and full reminder fields from a join
-- ============================================================

-- 1. Add date column
ALTER TABLE nova_reminder_embeddings ADD COLUMN IF NOT EXISTS date DATE;

-- Index on date for the pre-filter
CREATE INDEX IF NOT EXISTS idx_nova_embeddings_date ON nova_reminder_embeddings(date);

-- 2. Replace the RPC: now joins reminders table, accepts optional date range
CREATE OR REPLACE FUNCTION match_reminders_nova(
  query_embedding VECTOR(1024),
  match_threshold FLOAT,
  match_count INT,
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  reminder_id UUID,
  title TEXT,
  date DATE,
  time TEXT,
  completed BOOLEAN,
  tag_id UUID,
  priority_id UUID,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    r.id AS reminder_id,
    r.title,
    r.date,
    r.time,
    r.completed,
    r.tag_id,
    r.priority_id,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM nova_reminder_embeddings e
  JOIN reminders r ON r.id = e.reminder_id
  WHERE e.user_id = p_user_id
    AND (p_start_date IS NULL OR r.date >= p_start_date)
    AND (p_end_date IS NULL OR r.date <= p_end_date)
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
