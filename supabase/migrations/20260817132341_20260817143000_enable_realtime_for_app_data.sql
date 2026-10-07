/*
# Enable realtime synchronization for shared application data

1. Purpose
- Adds the application tables to Supabase's realtime publication.
- Allows open screens to receive inserts, updates, and deletes without a manual reload.

2. Tables enabled
- `project_messages`: project discussion messages.
- `task_updates`: daily task updates.
- `projects`: project creation and status changes.
- `tasks`: task assignment and workflow changes.
- `time_logs`: timer and work-log changes.
- `notifications`: dashboard and menu notifications.
- `payments`: payment status changes.
- `corrections`: correction workflow changes.

3. Security
- This migration changes only realtime publication membership.
- Existing row-level security policies continue to control which records each signed-in user can read.

4. Notes
- The block is idempotent and only adds a table when it is not already published.
- No existing rows or columns are changed.
*/

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_messages',
    'task_updates',
    'projects',
    'tasks',
    'time_logs',
    'notifications',
    'payments',
    'corrections'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = table_name
      ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;