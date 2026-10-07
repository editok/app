/*
# Add payment splits table for task-wise editor payments

## Problem
The current payment model stores a single `employee_amount` on the `payments` table,
supporting only one editor per project. Real projects have multiple editors working
on different tasks, so payments need to be split per-task.

## New Table: `payment_splits`
- `id` (uuid PK)
- `payment_id` (uuid FK → payments.id ON DELETE CASCADE)
- `project_id` (uuid FK → projects.id ON DELETE CASCADE)
- `task_id` (uuid FK → tasks.id ON DELETE SET NULL)
- `employee_id` (uuid FK → employees.id ON DELETE SET NULL)
- `employee_name` (text, denormalized for display)
- `task_name` (text, denormalized for display)
- `amount` (numeric, not null) — the portion allocated to this editor for this task
- `status` (text, default 'pending') — pending | paid
- `paid_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled with anon+authenticated full CRUD (matches the existing payments table policies).
- Index on employee_id for the Earnings page query.
*/

CREATE TABLE IF NOT EXISTS payment_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_name text,
  task_name text,
  amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_splits" ON payment_splits;
CREATE POLICY "anon_select_payment_splits" ON payment_splits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payment_splits" ON payment_splits;
CREATE POLICY "anon_insert_payment_splits" ON payment_splits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payment_splits" ON payment_splits;
CREATE POLICY "anon_update_payment_splits" ON payment_splits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payment_splits" ON payment_splits;
CREATE POLICY "anon_delete_payment_splits" ON payment_splits FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_payment_splits_employee ON payment_splits(employee_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_payment ON payment_splits(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_project ON payment_splits(project_id);

-- Enable realtime for payment_splits
ALTER PUBLICATION supabase_realtime ADD TABLE payment_splits;
