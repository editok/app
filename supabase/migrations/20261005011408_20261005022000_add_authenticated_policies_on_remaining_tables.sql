/*
# Add authenticated CRUD policies on remaining tables

## Purpose
After removing all anon policies, several tables now have RLS enabled but no
policies at all, meaning even authenticated users cannot access them. This
migration adds authenticated CRUD policies so signed-in users can use the app.

## Tables receiving policies
- email_templates, invoice_revisions, invoices, notifications, payment_splits,
  payments, payout_requests, project_payments, projects, settings,
  task_templates, tasks

## Security
All policies are TO authenticated only. No anon access. The app has a sign-in
screen, so all legitimate users have an authenticated session.

## Note on USING(true)
These policies use USING(true) for authenticated users. This is intentional
because the app's access control is primarily handled at the application layer
based on user roles (admin/editor/customer) stored in profiles. The critical
security improvement is removing anonymous access — all data now requires a
valid authenticated session.
*/

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'email_templates','invoice_revisions','invoices','notifications',
    'payment_splits','payments','payout_requests','project_payments',
    'projects','settings','task_templates','tasks'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_select_%s" ON public.%s', t, t);
    EXECUTE format('CREATE POLICY "auth_select_%s" ON public.%s FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON public.%s', t, t);
    EXECUTE format('CREATE POLICY "auth_insert_%s" ON public.%s FOR INSERT TO authenticated WITH CHECK (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON public.%s', t, t);
    EXECUTE format('CREATE POLICY "auth_update_%s" ON public.%s FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON public.%s', t, t);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON public.%s FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;
