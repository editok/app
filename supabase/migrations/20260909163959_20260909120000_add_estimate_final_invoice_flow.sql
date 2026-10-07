/*
# Add estimate-to-final-invoice workflow fields

## Purpose
Extends the existing invoices and project_payments tables to support a proper
estimate → customer approval → final invoice → payment proof → completion request
workflow. Also adds a completion-requested flag to projects.

## Changes

### invoices table (new columns)
- invoice_type (text, default 'final') — 'estimate' or 'final'. Estimates are
  draft bills shown to the customer for approval. Final invoices are the real
  bill created after estimate approval.
- status (text, default 'draft') — draft / sent / approved / rejected / revised.
  Tracks the customer-facing lifecycle of the invoice.
- sent_at (timestamptz, nullable) — when the invoice was sent to the customer.
- approved_at (timestamptz, nullable) — when the customer approved the estimate.
- rejected_reason (text, nullable) — if the customer rejected the estimate, why.

### project_payments table (new column)
- payment_proof (text, nullable) — URL to a screenshot/receipt the customer
  uploads as proof of payment. Stored in the review-files storage bucket.

### projects table (new column)
- completion_requested (boolean, default false) — set to true when the customer
  requests project completion / original file download.
- completion_requested_at (timestamptz, nullable) — when the request was made.

## Security
- All new columns inherit the existing RLS policies on their parent tables.
  No new policies needed — the tables already have full CRUD for anon+authenticated.
- The storage bucket 'review-files' already exists and has public-read policies;
  payment proof uploads use the same bucket with a 'payment-proofs/' prefix.

## Important Notes
1. Existing invoices default to invoice_type='final' and status='draft' so
   current data is unaffected.
2. The original_amount and current_amount columns remain — original_amount
   preserves the estimate amount, current_amount reflects the latest revision.
3. No data is lost — all additions are nullable or have safe defaults.
*/

-- ============ INVOICES: add estimate/final workflow columns ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'invoice_type') THEN
    ALTER TABLE invoices ADD COLUMN invoice_type text NOT NULL DEFAULT 'final';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'status') THEN
    ALTER TABLE invoices ADD COLUMN status text NOT NULL DEFAULT 'draft';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'sent_at') THEN
    ALTER TABLE invoices ADD COLUMN sent_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'approved_at') THEN
    ALTER TABLE invoices ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'rejected_reason') THEN
    ALTER TABLE invoices ADD COLUMN rejected_reason text;
  END IF;
END $$;

-- ============ PROJECT_PAYMENTS: add payment proof column ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_payments' AND column_name = 'payment_proof') THEN
    ALTER TABLE project_payments ADD COLUMN payment_proof text;
  END IF;
END $$;

-- ============ PROJECTS: add completion request columns ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'completion_requested') THEN
    ALTER TABLE projects ADD COLUMN completion_requested boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'completion_requested_at') THEN
    ALTER TABLE projects ADD COLUMN completion_requested_at timestamptz;
  END IF;
END $$;

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_projects_completion_requested ON projects(completion_requested);