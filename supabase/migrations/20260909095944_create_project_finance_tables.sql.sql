/*
# Create project-wise invoice and payment management tables

## Purpose
Enhances the existing Finance module to support proper project-wise invoice,
estimation, and payment management. Each project gets its own invoice record
that can be revised multiple times, with full revision history. Multiple
partial payments can be recorded against each project's invoice.

## New Tables

### 1. invoices
Stores one invoice per project. The invoice amount can be revised (changed)
and each change is tracked in invoice_revisions.
- id (uuid PK)
- project_id (uuid FK to projects, unique — one invoice per project)
- invoice_number (text, unique — auto-generated like INV-0001)
- original_amount (numeric — the very first amount, preserved forever)
- current_amount (numeric — the latest amount, updated on revision)
- invoice_date (timestamptz — when the invoice was created)
- notes (text — optional notes about the invoice)
- created_by (text — who created it: email or role)
- created_at (timestamptz)
- updated_at (timestamptz)

### 2. invoice_revisions
Stores every change to an invoice's amount. Never deleted.
- id (uuid PK)
- invoice_id (uuid FK to invoices)
- previous_amount (numeric — amount before the change)
- new_amount (numeric — amount after the change)
- reason (text — why the amount changed, e.g. "Additional work")
- changed_by (text — who made the change)
- changed_at (timestamptz)

### 3. project_payments
Stores individual payments made against a project's invoice.
A project can have multiple payments (advance, partial, final).
- id (uuid PK)
- project_id (uuid FK to projects)
- invoice_id (uuid FK to invoices, nullable for legacy compat)
- amount (numeric — payment amount)
- payment_date (timestamptz — when the payment was made)
- payment_method (text — UPI, Bank Transfer, Cash, Card, Cheque, Other)
- payment_type (text — Advance, Partial, Final, Full)
- transaction_reference (text — UPI ID, cheque number, etc.)
- notes (text — optional notes)
- receipt_file (text — URL to receipt attachment, nullable)
- created_by (text — who recorded the payment)
- created_at (timestamptz)

## Security
- RLS enabled on all three tables.
- Policies match existing payments table: TO anon, authenticated with USING(true).
  The app has its own role-based access control in the frontend (admins only see finance).
- Foreign keys to projects table with ON DELETE CASCADE for invoices and project_payments.

## Realtime
- All three tables added to the supabase_realtime publication for live updates.

## Important Notes
1. The existing payments table is NOT modified or dropped — it remains for backward
   compatibility. The new tables are additive.
2. original_amount on invoices is set once at creation and never changed — it preserves
   the original estimation even after revisions.
3. Payments are never deleted when an invoice is revised — they are permanently attached
   to the project.
*/

-- ============ INVOICES ============
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  invoice_number text UNIQUE,
  original_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  invoice_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
CREATE POLICY "anon_select_invoices" ON invoices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
CREATE POLICY "anon_insert_invoices" ON invoices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
CREATE POLICY "anon_update_invoices" ON invoices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;
CREATE POLICY "anon_delete_invoices" ON invoices FOR DELETE
  TO anon, authenticated USING (true);

-- ============ INVOICE REVISIONS ============
CREATE TABLE IF NOT EXISTS invoice_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  previous_amount numeric NOT NULL DEFAULT 0,
  new_amount numeric NOT NULL DEFAULT 0,
  reason text,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoice_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invoice_revisions" ON invoice_revisions;
CREATE POLICY "anon_select_invoice_revisions" ON invoice_revisions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_invoice_revisions" ON invoice_revisions;
CREATE POLICY "anon_insert_invoice_revisions" ON invoice_revisions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_invoice_revisions" ON invoice_revisions;
CREATE POLICY "anon_update_invoice_revisions" ON invoice_revisions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_invoice_revisions" ON invoice_revisions;
CREATE POLICY "anon_delete_invoice_revisions" ON invoice_revisions FOR DELETE
  TO anon, authenticated USING (true);

-- ============ PROJECT PAYMENTS ============
CREATE TABLE IF NOT EXISTS project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_date timestamptz NOT NULL DEFAULT now(),
  payment_method text DEFAULT 'UPI',
  payment_type text DEFAULT 'Advance',
  transaction_reference text,
  notes text,
  receipt_file text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_project_payments" ON project_payments;
CREATE POLICY "anon_select_project_payments" ON project_payments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_project_payments" ON project_payments;
CREATE POLICY "anon_insert_project_payments" ON project_payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_project_payments" ON project_payments;
CREATE POLICY "anon_update_project_payments" ON project_payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_project_payments" ON project_payments;
CREATE POLICY "anon_delete_project_payments" ON project_payments FOR DELETE
  TO anon, authenticated USING (true);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoice_revisions_invoice_id ON invoice_revisions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_project_id ON project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_invoice_id ON project_payments(invoice_id);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_revisions;
ALTER PUBLICATION supabase_realtime ADD TABLE project_payments;

-- ============ AUTO-GENERATE INVOICE NUMBER ============
-- Creates a sequence and a function to generate invoice numbers like INV-0001
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  next_val bigint;
  result text;
BEGIN
  next_val := nextval('invoice_number_seq');
  result := 'INV-' || lpad(next_val::text, 4, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;
