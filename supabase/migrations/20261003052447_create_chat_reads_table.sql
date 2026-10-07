/*
# Per-user chat read state

## What changed
Previously, chat read state was stored in localStorage (`chat-read-state` key).
This is per-browser, not per-user-account: the same user on a different device
would lose their read state, and two different users sharing a browser would
interfere with each other's read state.

This migration introduces a `chat_reads` table that tracks per-user, per-project
chat read timestamps. Each row records: which user last read which project's chat,
and when.

## New table
- `chat_reads`
  - `id` (uuid, primary key)
  - `project_id` (uuid, FK to projects, ON DELETE CASCADE)
  - `user_id` (uuid, FK to auth.users, ON DELETE CASCADE)
  - `last_read_at` (timestamptz, not null — when the user last read the chat)
  - `created_at` (timestamptz, default now())
  - UNIQUE constraint on (project_id, user_id) — one read record per user per project

## Security
- RLS enabled on `chat_reads`.
- SELECT: users can only see their own read records.
- INSERT: users can only insert their own read records.
- UPDATE: users can only update their own read records.
- DELETE: users can only delete their own read records.

## Important notes
1. The frontend will use this table as the source of truth, with localStorage as
   a fast synchronous cache. On app load, the frontend fetches the user's chat_reads
   and popates the cache. On `markChatRead`, both the DB and localStorage are updated.
2. No data migration is needed — the old localStorage cache will simply be replaced
   by the DB-backed values on first load.
*/
CREATE TABLE IF NOT EXISTS chat_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_reads" ON chat_reads;
CREATE POLICY "select_own_chat_reads"
ON chat_reads FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_reads" ON chat_reads;
CREATE POLICY "insert_own_chat_reads"
ON chat_reads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_reads" ON chat_reads;
CREATE POLICY "update_own_chat_reads"
ON chat_reads FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_reads" ON chat_reads;
CREATE POLICY "delete_own_chat_reads"
ON chat_reads FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_reads_unique
ON chat_reads (project_id, user_id);