-- Add payment verification workflow to project_payments
ALTER TABLE project_payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Backfill existing payments as verified (they were admin-recorded)
UPDATE project_payments SET status = 'verified', verified_by = created_by, verified_at = created_at WHERE status = 'pending_verification' AND created_by != 'customer' AND payment_proof IS NULL;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_project_payments_status ON project_payments(status);
