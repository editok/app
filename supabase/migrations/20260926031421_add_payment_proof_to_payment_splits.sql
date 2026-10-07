/*
# Add payment_proof column to payment_splits

1. Modified Tables
- `payment_splits`: adds `payment_proof` (text, nullable) to store a screenshot/URL
  of the payment receipt uploaded by the admin when marking splits as paid.
2. Security
- No RLS changes — payment_splits already has existing policies. The new column
  is covered by the existing CRUD policies on the table.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_splits' AND column_name = 'payment_proof'
  ) THEN
    ALTER TABLE payment_splits ADD COLUMN payment_proof text;
  END IF;
END $$;
