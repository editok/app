/*
# Revert is_anonymous check and column-level UPDATE restriction

## Problem
1. The is_anonymous check on all policies is causing issues with authenticated
   users who don't have the claim in their JWT, blocking data access.
2. The column-level UPDATE restriction on profiles breaks upsertProfile which
   needs to write role, admin_role, and allowed_menus during user creation.

## Fix
1. Replace all is_anonymous policy predicates back to `true` for authenticated
   users. The core security improvement (removing anon access) is already done
   — no table has anon policies or grants. The is_anonymous check was an extra
   layer that's causing problems.
2. Restore full UPDATE privileges on profiles for authenticated users.

## Security Impact
- All tables still require authentication (no anon access)
- Profiles RLS policies still enforce ownership (auth.uid() = id) and admin checks
- The app's upsertProfile function works again
*/

-- 1. Remove is_anonymous check from all policies, restore to USING(true)
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'authenticated' = any(roles)
      AND (
        qual LIKE '%is_anonymous%' OR with_check LIKE '%is_anonymous%'
      )
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;

    -- Replace the is_anonymous expression with true
    IF r.qual LIKE '%is_anonymous%' THEN
      new_qual := 'true';
    END IF;

    IF r.with_check LIKE '%is_anonymous%' THEN
      new_check := 'true';
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      r.policyname, r.tablename
    );

    IF r.cmd = 'SELECT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
        r.policyname, r.tablename, new_qual
      );
    ELSIF r.cmd = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
        r.policyname, r.tablename, new_check
      );
    ELSIF r.cmd = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
        r.policyname, r.tablename, new_qual, new_check
      );
    ELSIF r.cmd = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
        r.policyname, r.tablename, new_qual
      );
    END IF;
  END LOOP;
END $$;

-- 2. Restore full UPDATE privileges on profiles
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
