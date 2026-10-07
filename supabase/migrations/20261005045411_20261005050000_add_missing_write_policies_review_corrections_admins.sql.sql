/*
# Add missing write policies on review_files, corrections, and admins

## Problem
The recent security-hardening migrations (20261005011349, 20261005011408)
dropped old anon/guest policies on review_files and corrections and replaced
them with SELECT-only authenticated policies. This left both tables without
INSERT, UPDATE, or DELETE policies. As a result:
- Admins cannot upload review files (INSERT on review_files fails)
- Customers/editors cannot submit corrections (INSERT on corrections fails)
- Corrections cannot be updated or resolved (UPDATE on corrections fails)
- The Admins page cannot list admin users (SELECT on admins missing)

The admins table also lost its SELECT policy during the hardening and only
has INSERT/UPDATE/DELETE restricted to the main admin role.

## Changes
1. Add INSERT, UPDATE, DELETE policies on review_files for authenticated users
2. Add INSERT, UPDATE, DELETE policies on corrections for authenticated users
3. Add SELECT policy on admins for authenticated admin users

## Security
All policies are TO authenticated only (no anon). The app has a sign-in
screen so all legitimate users have an authenticated session. Access control
at the application layer determines which role can perform which action.
The admins SELECT policy restricts reads to authenticated admin users.
*/

-- ============ review_files: add missing INSERT / UPDATE / DELETE ============

DROP POLICY IF EXISTS "auth_insert_review_files" ON public.review_files;
CREATE POLICY "auth_insert_review_files"
ON public.review_files FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_review_files" ON public.review_files;
CREATE POLICY "auth_update_review_files"
ON public.review_files FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_review_files" ON public.review_files;
CREATE POLICY "auth_delete_review_files"
ON public.review_files FOR DELETE TO authenticated
USING (true);

-- ============ corrections: add missing INSERT / UPDATE / DELETE ============

DROP POLICY IF EXISTS "auth_insert_corrections" ON public.corrections;
CREATE POLICY "auth_insert_corrections"
ON public.corrections FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_corrections" ON public.corrections;
CREATE POLICY "auth_update_corrections"
ON public.corrections FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_corrections" ON public.corrections;
CREATE POLICY "auth_delete_corrections"
ON public.corrections FOR DELETE TO authenticated
USING (true);

-- ============ admins: add missing SELECT for admin users ============

DROP POLICY IF EXISTS "auth_select_admins" ON public.admins;
CREATE POLICY "auth_select_admins"
ON public.admins FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));
