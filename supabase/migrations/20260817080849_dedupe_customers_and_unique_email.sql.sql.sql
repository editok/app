/*
# Deduplicate customers and enforce unique email

## Why
The customers table had no uniqueness constraint on `email`, so the automatic
customer-on-login routine (`ensureCustomerForProfile`) inserted a new row on
nearly every sign-in for the same user. One email accumulated 21 duplicate
rows. The duplicate rows are visible in the admin Customers screen.

## Changes
1. **Data cleanup (safe, non-destructive to projects):**
   For each email that appears on more than one row, keep the single newest
   row (latest created_at, tie-broken by id) and delete the older duplicates.
   Rows with NULL email are left untouched.
   Verified before running: none of the duplicate rows are referenced by any
   row in `projects` (customer_id / customer_email), so deletion orphans nothing.
2. **Schema:**
   Add a unique index on `customers(email)` where email is not null, so the
   database refuses future duplicate emails. Partial index keeps NULL emails
   (legacy/manual rows) allowed.
3. **RLS:** No policy changes. Existing anon/authenticated CRUD policies remain.
*/

WITH ranked AS (
  SELECT
    id,
    email,
    created_at,
    row_number() OVER (
      PARTITION BY email
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM customers
  WHERE email IS NOT NULL
)
DELETE FROM customers
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique_idx
  ON customers (email)
  WHERE email IS NOT NULL;
