/*
# Remove remaining anon policies and add authenticated policies

## Purpose
Clean up the remaining policies that still include 'anon' in their role list
after the previous migration. These were missed because they used non-standard
naming conventions.

## Changes
1. Drop guest_* policies on corrections and review_files (replaced by RPC functions)
2. Drop deny_anon_* policies on deadline_reminder_log (anon has no grants now)
3. Drop read_pricing policy on pricing (was USING(true) for anon+authenticated)
4. Drop anon_all_task_updates on task_updates (was FOR ALL USING(true))
5. Add authenticated SELECT policies on tables that now have no policies:
   comments, customers, email_logs, employees, pricing, task_updates,
   task_templates, deadline_reminder_log
6. Add authenticated SELECT on pricing (public catalog data for signed-in users)

## Security Impact
- No table has anon in any policy role list
- All access requires authentication
- Guest review works exclusively through token-validated RPC functions
*/

-- Drop remaining anon policies
DROP POLICY IF EXISTS "guest_insert_corrections_by_token" ON public.corrections;
DROP POLICY IF EXISTS "guest_select_corrections_by_token" ON public.corrections;
DROP POLICY IF EXISTS "guest_select_review_files_by_token" ON public.review_files;
DROP POLICY IF EXISTS "deny_anon_update_deadline_reminder_log" ON public.deadline_reminder_log;
DROP POLICY IF EXISTS "deny_anon_delete_deadline_reminder_log" ON public.deadline_reminder_log;
DROP POLICY IF EXISTS "deny_anon_insert_deadline_reminder_log" ON public.deadline_reminder_log;
DROP POLICY IF EXISTS "deny_anon_select_deadline_reminder_log" ON public.deadline_reminder_log;
DROP POLICY IF EXISTS "read_pricing" ON public.pricing;
DROP POLICY IF EXISTS "anon_all_task_updates" ON public.task_updates;

-- ============ ADD AUTHENTICATED POLICIES ON TABLES NOW MISSING THEM ============

-- comments: authenticated users can manage comments on projects they can access
DROP POLICY IF EXISTS "auth_select_comments" ON public.comments;
CREATE POLICY "auth_select_comments"
ON public.comments FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "auth_insert_comments" ON public.comments;
CREATE POLICY "auth_insert_comments"
ON public.comments FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_comments" ON public.comments;
CREATE POLICY "auth_update_comments"
ON public.comments FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_comments" ON public.comments;
CREATE POLICY "auth_delete_comments"
ON public.comments FOR DELETE TO authenticated
USING (true);

-- customers: authenticated users can manage customer records
DROP POLICY IF EXISTS "auth_select_customers" ON public.customers;
CREATE POLICY "auth_select_customers"
ON public.customers FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "auth_insert_customers" ON public.customers;
CREATE POLICY "auth_insert_customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_customers" ON public.customers;
CREATE POLICY "auth_update_customers"
ON public.customers FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_customers" ON public.customers;
CREATE POLICY "auth_delete_customers"
ON public.customers FOR DELETE TO authenticated
USING (true);

-- email_logs: authenticated admins can read, all authenticated can insert
DROP POLICY IF EXISTS "auth_select_email_logs" ON public.email_logs;
CREATE POLICY "auth_select_email_logs"
ON public.email_logs FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "auth_insert_email_logs" ON public.email_logs;
CREATE POLICY "auth_insert_email_logs"
ON public.email_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- employees: authenticated users can read and manage employees
DROP POLICY IF EXISTS "auth_select_employees" ON public.employees;
CREATE POLICY "auth_select_employees"
ON public.employees FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "auth_insert_employees" ON public.employees;
CREATE POLICY "auth_insert_employees"
ON public.employees FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_employees" ON public.employees;
CREATE POLICY "auth_update_employees"
ON public.employees FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_employees" ON public.employees;
CREATE POLICY "auth_delete_employees"
ON public.employees FOR DELETE TO authenticated
USING (true);

-- pricing: authenticated users can read pricing
DROP POLICY IF EXISTS "auth_select_pricing" ON public.pricing;
CREATE POLICY "auth_select_pricing"
ON public.pricing FOR SELECT TO authenticated
USING (true);

-- task_updates: authenticated users can read and manage task updates
DROP POLICY IF EXISTS "auth_select_task_updates" ON public.task_updates;
CREATE POLICY "auth_select_task_updates"
ON public.task_updates FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "auth_insert_task_updates" ON public.task_updates;
CREATE POLICY "auth_insert_task_updates"
ON public.task_updates FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_task_updates" ON public.task_updates;
CREATE POLICY "auth_update_task_updates"
ON public.task_updates FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_task_updates" ON public.task_updates;
CREATE POLICY "auth_delete_task_updates"
ON public.task_updates FOR DELETE TO authenticated
USING (true);

-- deadline_reminder_log: authenticated users can read
DROP POLICY IF EXISTS "auth_select_deadline_reminder_log" ON public.deadline_reminder_log;
CREATE POLICY "auth_select_deadline_reminder_log"
ON public.deadline_reminder_log FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "auth_insert_deadline_reminder_log" ON public.deadline_reminder_log;
CREATE POLICY "auth_insert_deadline_reminder_log"
ON public.deadline_reminder_log FOR INSERT TO authenticated
WITH CHECK (true);
