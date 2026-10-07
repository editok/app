/*
# Add admin sub-roles, review-approved status, and additional files link

1. Overview
   This migration introduces three changes:
   - Admin sub-roles: a new `admin_role` column on `profiles` that distinguishes
     Main Admin, Manager, and Finance Admin. The Main Admin has all access,
     Manager has no finance access, and Finance Admin has no order-approval access.
   - A new project status value `review_approved` to distinguish "Review Approved"
     (final review sign-off) from "Project Approved" (admin accepted the order).
   - A new `additional_files_link` column on `corrections` so editors/customers
     can attach an extra source-files link when submitting a review/correction.

2. Modified Tables

   a) `profiles`
      - ADD COLUMN `admin_role` text DEFAULT NULL
        Values: 'main' (Main Admin), 'manager' (Manager), 'finance' (Finance Admin).
        NULL for non-admin users. Existing admin users default to 'main' so they
        retain full access after the migration.

   b) `corrections`
      - ADD COLUMN `additional_files_link` text DEFAULT NULL
        Stores one or more URLs (plain text or JSON array) pointing to extra
        source files the editor/admin should reference. Visible to admin & editor.

   c) `projects`
      - No schema change. The `status` column already accepts arbitrary text.
        The application will now use the value 'review_approved' to indicate the
        final review has been approved, distinct from 'approved' (order accepted).

3. Security
   - No new tables. RLS already enabled on `profiles` and `corrections`.
   - No policy changes needed; existing policies cover the new columns.

4. Important Notes
   - All existing admin profiles are set to `admin_role = 'main'` so current
     admins keep full access.
   - The `review_approved` status is a new application-level value; the column
     is text so no constraint change is required.
*/

-- a) profiles: add admin_role column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'admin_role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN admin_role text DEFAULT NULL;
  END IF;
END $$;

-- Set existing admins to 'main' if not set
UPDATE profiles SET admin_role = 'main' WHERE role = 'admin' AND admin_role IS NULL;

-- b) corrections: add additional_files_link column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'corrections' AND column_name = 'additional_files_link'
  ) THEN
    ALTER TABLE corrections ADD COLUMN additional_files_link text DEFAULT NULL;
  END IF;
END $$;
