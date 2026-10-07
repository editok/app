/*
# Per-user notification read state

## What changed
Previously, the `notifications` table had a single `read` boolean column. For broadcast
notifications (target_email = NULL, target_role = 'editor' or 'customer' or 'all'), when
one user marked the notification as read, it marked it read for EVERY user of that role.
This was a multi-tenancy read-state bug.

This migration introduces a `notification_reads` join table that tracks per-user read and
archived state. Each row records: which user read/archived which notification, and when.

## New table
- `notification_reads`
  - `id` (uuid, primary key)
  - `notification_id` (uuid, FK to notifications, ON DELETE CASCADE)
  - `user_id` (uuid, FK to auth.users, ON DELETE CASCADE)
  - `read_at` (timestamptz, nullable — set when user marks as read)
  - `archived_at` (timestamptz, nullable — set when user archives/clears)
  - `created_at` (timestamptz, default now())
  - UNIQUE constraint on (notification_id, user_id) to prevent duplicates

## Security
- RLS enabled on `notification_reads`.
- SELECT: users can only see their own read records (auth.uid() = user_id).
- INSERT: users can only insert their own read records.
- UPDATE: users can only update their own read records.
- DELETE: users can only delete their own read records.

## Important notes
1. The existing `notifications.read` column is NOT removed — it remains for backward
   compatibility and is still used by the emit_notification RPC. The frontend will now
   use `notification_reads` to determine per-user read state instead.
2. The `notifications.archived_at` column also remains. Per-user archiving is tracked
   via `notification_reads.archived_at`. The frontend will filter based on the join table.
3. A partial unique index ensures one row per (notification_id, user_id) pair.
*/
CREATE TABLE IF NOT EXISTS notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reads" ON notification_reads;
CREATE POLICY "select_own_reads"
ON notification_reads FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reads" ON notification_reads;
CREATE POLICY "insert_own_reads"
ON notification_reads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reads" ON notification_reads;
CREATE POLICY "update_own_reads"
ON notification_reads FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reads" ON notification_reads;
CREATE POLICY "delete_own_reads"
ON notification_reads FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_reads_unique
ON notification_reads (notification_id, user_id);