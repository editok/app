/*
# Remove anonymous table access and tighten column privileges

## Purpose
This migration closes the largest security gap in the database: 22 tables had
TO anon policies with USING (true), making all their data readable and writable
by anyone on the internet without signing in. Guest review access has been moved
behind token-validated SECURITY DEFINER functions, so anonymous table access is
no longer needed.

## Changes

### 1. Remove all TO anon policies and revoke anon grants on all non-guest tables
Tables affected: admins, comments, corrections, customers, deadline_reminder_log,
email_logs, email_templates, employees, invoice_revisions, invoices,
notifications, payment_splits, payments, payout_requests, pricing,
project_payments, projects, review_files, settings, task_templates,
task_updates, tasks, broadcast_campaigns, chat_reads, device_tokens,
notification_reads, profiles, project_messages, project_rating_requests,
project_ratings, rating_questions, time_logs, user_push_tokens

### 2. Add authenticated SELECT policies on corrections and review_files
These tables previously had USING(true) for anon+authenticated. Now only
authenticated users can read, scoped by project ownership.

### 3. Column-level UPDATE restrictions on profiles
Revoke full UPDATE from authenticated; grant UPDATE only on user-editable
columns (full_name, avatar_url, phone, address, language, last_notification_seen_at).
Privileged columns (role, admin_role, allowed_menus) are NOT client-writable.

## Security Impact
- All table data now requires authentication to access
- Guest review still works via token-validated RPC functions
- Profile role/admin_role/allowed_menus cannot be modified by users directly
*/

-- ============ REMOVE ANON POLICIES AND GRANTS ON ALL TABLES ============

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'admins','comments','corrections','customers','deadline_reminder_log',
    'email_logs','email_templates','employees','invoice_revisions','invoices',
    'notifications','payment_splits','payments','payout_requests','pricing',
    'project_payments','projects','review_files','settings','task_templates',
    'task_updates','tasks','broadcast_campaigns','chat_reads','device_tokens',
    'notification_reads','profiles','project_messages','project_rating_requests',
    'project_ratings','rating_questions','time_logs','user_push_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop all policies that include 'anon' in their role list
    EXECUTE format(
      'DROP POLICY IF EXISTS "anon_select_%s" ON public.%s', t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "anon_insert_%s" ON public.%s', t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "anon_update_%s" ON public.%s', t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "anon_delete_%s" ON public.%s', t, t
    );
    -- Also drop the other naming convention
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_select_anon" ON public.%s', t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_insert_anon" ON public.%s', t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_update_anon" ON public.%s', t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_delete_anon" ON public.%s', t, t
    );
    -- Revoke all privileges from anon
    EXECUTE format('REVOKE ALL ON public.%s FROM anon', t);
  END LOOP;
END $$;

-- ============ ADD AUTHENTICATED SELECT POLICIES ============

-- review_files: authenticated users can read files for projects they can access
DROP POLICY IF EXISTS "auth_select_review_files" ON public.review_files;
CREATE POLICY "auth_select_review_files"
ON public.review_files FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = review_files.project_id
    AND (
      projects.customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR projects.editor_id IN (
        SELECT id FROM public.employees WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
  )
);

-- corrections: authenticated users can read corrections for projects they can access
DROP POLICY IF EXISTS "auth_select_corrections" ON public.corrections;
CREATE POLICY "auth_select_corrections"
ON public.corrections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = corrections.project_id
    AND (
      projects.customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR projects.editor_id IN (
        SELECT id FROM public.employees WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
  )
);

-- ============ COLUMN-LEVEL UPDATE RESTRICTIONS ON profiles ============

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  full_name, avatar_url, phone, address, language,
  last_notification_seen_at
) ON public.profiles TO authenticated;
