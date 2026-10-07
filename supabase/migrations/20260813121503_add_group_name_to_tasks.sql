/*
# Add group_name to tasks table

1. Purpose
- The task_templates table already has a group_name column for grouping templates.
- The tasks table has no grouping concept — tasks are flat with just a sequence number.
- This migration adds a group_name column to tasks so manually created tasks can be grouped together.

2. Changes
- Added `group_name` (text, nullable) to the `tasks` table.
- Added an index on (project_id, group_name) for efficient group-based queries.

3. Security
- No RLS policy changes — tasks already has existing policies.
- No new tables created.
*/

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS group_name text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_group
  ON tasks (project_id, group_name);
