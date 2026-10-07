/*
# Add Payment Transaction & Employee Earning Fields

## Purpose
Extends the payments table to store transaction reference details and employee payout amounts,
so that when an admin confirms a payment, the transaction ID, payment method, and the amount
owed to the assigned employee are all recorded. This enables:
1. Admin to mark a project as "Paid" with a transaction ID reference.
2. Employees to see their earnings per completed project via a new Earnings page.

## Changes to existing tables

### payments (modified)
- `transaction_id` (text) — admin-entered transaction/reference number for the payment (e.g. UPI ref, bank txn id)
- `payment_method` (text) — how the customer paid (UPI, Bank Transfer, Cash, Card, etc.)
- `payment_notes` (text) — optional notes about the payment
- `employee_amount` (numeric, default 0) — the portion of the project amount paid to the assigned employee/editor
- `employee_paid` (boolean, default false) — whether the employee payout has been disbursed
- `employee_paid_at` (timestamptz) — when the employee was paid

All new columns are nullable/defaulted so existing rows and the existing workflow are unaffected.

## Security
- No new tables. RLS already enabled on payments.
- Existing anon/authenticated CRUD policies on payments cover the new columns automatically (column-level privileges are not restricted).
*/

-- Add transaction reference fields to payments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'transaction_id') THEN
    ALTER TABLE payments ADD COLUMN transaction_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_method') THEN
    ALTER TABLE payments ADD COLUMN payment_method text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_notes') THEN
    ALTER TABLE payments ADD COLUMN payment_notes text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'employee_amount') THEN
    ALTER TABLE payments ADD COLUMN employee_amount numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'employee_paid') THEN
    ALTER TABLE payments ADD COLUMN employee_paid boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'employee_paid_at') THEN
    ALTER TABLE payments ADD COLUMN employee_paid_at timestamptz;
  END IF;
END $$;
