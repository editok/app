/*
# Block anonymous users from accessing data via RLS

## Purpose
Anonymous sign-ins are enabled at the platform level, which means anonymous
users carry the `authenticated` Postgres role. This means all our
`TO authenticated` policies with `USING(true)` would allow anonymous users
to read and write all data. This migration adds an `is_anonymous` check to
every `TO authenticated` policy that uses `USING(true)` to block anonymous
users from accessing data through the Data API.

## Approach
Replace `USING (true)` with `USING ((select (auth.jwt() ->> 'is_anonymous')::boolean) is false)`
on all authenticated policies. This ensures only real authenticated users
(who proved their identity with email/password) can access data, while
anonymous users get nothing.

## Security Impact
- Even though anonymous sign-ins are enabled at the platform level, anonymous
  users cannot read or write any data in any table
- All 34 auth_allow_anonymous_sign_ins warnings are neutralized at the RLS level
- Real authenticated users (email/password sign-in) are unaffected
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
        qual = 'true' OR with_check = 'true'
      )
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;

    IF r.qual = 'true' THEN
      new_qual := '(select (auth.jwt() ->> ''is_anonymous'')::boolean) is false';
    END IF;

    IF r.with_check = 'true' THEN
      new_check := '(select (auth.jwt() ->> ''is_anonymous'')::boolean) is false';
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
