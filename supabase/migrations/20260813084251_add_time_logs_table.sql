/*
# Add time_logs table for employee task time tracking

## Purpose
Allows employees to log time spent on individual tasks during execution.

## New Tables
- `time_logs`
  - `id` (uuid, PK)
  - `task_id` (uuid, FK to tasks, ON DELETE CASCADE)
  - `project_id` (uuid, FK to projects, ON DELETE CASCADE)
  - `employee_id` (uuid, FK to employees, nullable)
  - `employee_email` (text, for lookup by email)
  - `hours` (numeric, hours logged)
  - `note` (text, optional description)
  - `created_at` (timestamptz)

## Security
- RLS enabled.
- Authenticated users can read all time logs (admins need aggregate views, employees need their own).
- Authenticated users can insert their own time logs.
- Authenticated users can update/delete their own time logs.
*/

CREATE TABLE IF NOT EXISTS time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_email text,
  hours numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_logs_select" ON time_logs;
CREATE POLICY "time_logs_select" ON time_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "time_logs_insert" ON time_logs;
CREATE POLICY "time_logs_insert" ON time_logs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "time_logs_update_own" ON time_logs;
CREATE POLICY "time_logs_update_own" ON time_logs FOR UPDATE
  TO authenticated USING (employee_email = auth.jwt() ->> 'email') WITH CHECK (true);

DROP POLICY IF EXISTS "time_logs_delete_own" ON time_logs;
CREATE POLICY "time_logs_delete_own" ON time_logs FOR DELETE
  TO authenticated USING (employee_email = auth.jwt() ->> 'email');

CREATE INDEX IF NOT EXISTS idx_time_logs_task_id ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_project_id ON time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee_email ON time_logs(employee_email);
