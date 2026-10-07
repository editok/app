/*
# Create payout_requests table for editor payout requests

Editors can request payouts for one or more approved (pending) payment_splits.
Admin gets notified to process the disbursement.

## New Table: `payout_requests`
- id (uuid PK)
- employee_id (uuid FK → employees.id ON DELETE CASCADE)
- employee_name (text, denormalized for display)
- split_ids (uuid[] — list of payment_split ids included in this request)
- total_amount (numeric — sum of split amounts)
- status (text default 'requested' — requested | processed | rejected)
- requested_at (timestamptz default now())
- processed_at (timestamptz nullable)
- notes (text nullable — admin notes when processing)
*/

CREATE TABLE IF NOT EXISTS payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  employee_name text,
  split_ids uuid[] NOT NULL DEFAULT '{}',
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  notes text
);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payout_requests" ON payout_requests;
CREATE POLICY "anon_select_payout_requests" ON payout_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payout_requests" ON payout_requests;
CREATE POLICY "anon_insert_payout_requests" ON payout_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payout_requests" ON payout_requests;
CREATE POLICY "anon_update_payout_requests" ON payout_requests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payout_requests" ON payout_requests;
CREATE POLICY "anon_delete_payout_requests" ON payout_requests FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_payout_requests_employee ON payout_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

ALTER PUBLICATION supabase_realtime ADD TABLE payout_requests;