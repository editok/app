/*
# Create deadline_reminder_log table

## Purpose
Tracks which projects have already received a deadline reminder email,
so the scheduled deadline-checker edge function doesn't send duplicate
reminders for the same project on every run.

## New Tables
- `deadline_reminder_log`
  - `id` (uuid, primary key)
  - `project_id` (uuid, references projects)
  - `reminder_type` (text: ' approaching' or 'overdue')
  - `sent_at` (timestamptz, default now())

## Security
- RLS enabled. No client-side access needed — only the edge function
  (using service role key) reads/writes this table.
- Policies deny all access from anon/authenticated roles since this is
  an internal system table managed solely by the edge function.
*/

CREATE TABLE IF NOT EXISTS deadline_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'approaching',
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deadline_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_select_deadline_reminder_log" ON deadline_reminder_log;
CREATE POLICY "deny_anon_select_deadline_reminder_log"
ON deadline_reminder_log FOR SELECT
TO anon, authenticated
USING (false);

DROP POLICY IF EXISTS "deny_anon_insert_deadline_reminder_log" ON deadline_reminder_log;
CREATE POLICY "deny_anon_insert_deadline_reminder_log"
ON deadline_reminder_log FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_update_deadline_reminder_log" ON deadline_reminder_log;
CREATE POLICY "deny_anon_update_deadline_reminder_log"
ON deadline_reminder_log FOR UPDATE
TO anon, authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_delete_deadline_reminder_log" ON deadline_reminder_log;
CREATE POLICY "deny_anon_delete_deadline_reminder_log"
ON deadline_reminder_log FOR DELETE
TO anon, authenticated
USING (false);

CREATE INDEX IF NOT EXISTS idx_deadline_reminder_log_project ON deadline_reminder_log(project_id);
CREATE INDEX IF NOT EXISTS idx_deadline_reminder_log_sent ON deadline_reminder_log(sent_at);
