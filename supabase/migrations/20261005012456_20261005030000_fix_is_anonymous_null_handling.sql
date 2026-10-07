/*
# Fix is_anonymous check to handle NULL JWT claim

## Problem
The previous migration added `(auth.jwt() ->> 'is_anonymous')::boolean is false`
to all authenticated policies. For normal email/password users, the
`is_anonymous` claim is absent from the JWT, so the expression evaluates to
`NULL is false` which is `NULL` (not `true`). This blocks ALL data access for
authenticated users, causing a blank screen because the profile lookup fails
and the app stays stuck on the loading screen.

## Fix
Replace the check with `COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) is false`
which treats a missing/NULL claim as `false` (not anonymous), allowing normal
authenticated users through while still blocking actual anonymous users.

## Security Impact
- Anonymous users (who have `is_anonymous: true` in their JWT) are still blocked
- Normal authenticated users (email/password, Google) with no `is_anonymous` claim
  are now able to access data as expected
*/

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

    -- Fix the is_anonymous check to handle NULL (missing claim = not anonymous)
    IF r.qual LIKE '%is_anonymous%' THEN
      new_qual := replace(r.qual,
        '(select (auth.jwt() ->> ''is_anonymous'')::boolean) is false',
        'COALESCE((select (auth.jwt() ->> ''is_anonymous'')::boolean), false) is false'
      );
    END IF;

    IF r.with_check LIKE '%is_anonymous%' THEN
      new_check := replace(r.with_check,
        '(select (auth.jwt() ->> ''is_anonymous'')::boolean) is false',
        'COALESCE((select (auth.jwt() ->> ''is_anonymous'')::boolean), false) is false'
      );
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
