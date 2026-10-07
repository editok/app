-- P1: Add group_name, stages JSONB, sort_order to task_templates
ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS group_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stages jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- P5: Create task_updates table for daily updates from employees
CREATE TABLE IF NOT EXISTS task_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  employee_email text,
  update_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_task_updates" ON task_updates;
CREATE POLICY "anon_all_task_updates" ON task_updates
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- P4: Add index on tasks for unassigned query performance
CREATE INDEX IF NOT EXISTS idx_tasks_unassigned_pending
  ON tasks (assigned_to, status)
  WHERE assigned_to IS NULL;
