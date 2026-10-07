/*
# Fix is_anonymous check - use IS NOT TRUE instead of IS FALSE

## Problem
The expression `(auth.jwt() ->> 'is_anonymous')::boolean IS FALSE` blocks
normal authenticated users because:
- false IS FALSE → TRUE (allowed - non-anonymous, correct)
- true IS FALSE → FALSE (blocked - anonymous, correct)
- NULL IS FALSE → FALSE (blocked - WRONG for normal users with missing claim)

Normal email/password users don't have the is_anonymous claim in their JWT,
so it evaluates to NULL, and NULL IS FALSE returns FALSE, blocking all access.

## Fix
Change IS FALSE to IS NOT TRUE:
- false IS NOT TRUE → TRUE (allowed - non-anonymous, correct)
- true IS NOT TRUE → FALSE (blocked - anonymous, correct)
- NULL IS NOT TRUE → TRUE (allowed - normal users with missing claim, FIXED)

## Security Impact
Anonymous users (is_anonymous: true) are still blocked.
Normal authenticated users (missing claim, or false) are allowed.
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

    -- Replace IS FALSE with IS NOT TRUE in the is_anonymous check
    IF r.qual LIKE '%is_anonymous%IS FALSE%' THEN
      new_qual := replace(r.qual, 'IS FALSE', 'IS NOT TRUE');
    END IF;

    IF r.with_check LIKE '%is_anonymous%IS FALSE%' THEN
      new_check := replace(r.with_check, 'IS FALSE', 'IS NOT TRUE');
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
