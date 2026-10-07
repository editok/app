ALTER TABLE invoices ADD COLUMN IF NOT EXISTS advance_amount numeric DEFAULT 0;
