/*
# Add missing indexes and optimize RLS policies with (SELECT auth.uid())

## 1. New Indexes
This migration adds indexes on frequently filtered/ordered columns that are currently missing:
- `projects.editor_id` — queried by fetchProjectsForEditor, fetchProjectIdsForEditor
- `projects.created_at` — used for ordering in fetchProjects, fetchProjectsByCustomer
- `payments.created_at` — used for ordering in fetchAllPayments
- `payments.project_id` — queried by fetchPayment, fetchPaymentsByProjectIds
- `notifications.created_at` — used for ordering in all notification queries
- `corrections.created_at` — used for ordering in fetchCorrections
- `employees.created_at` — used for ordering in fetchEmployees
- `task_updates.task_id` — queried by fetchTaskUpdatesByTaskIds
- `device_tokens.user_id` — queried for push token lookup
- `project_ratings.target_employee_id` — queried by fetchRatingsByEmployee
- `project_ratings.rating_request_id` — queried by fetchRatingsByRequest
- `project_rating_requests.customer_email` — queried by fetchRatingRequestsByCustomer
- `task_templates.sort_order` — used for ordering

## 2. RLS Policy Optimization
Replaces direct `auth.uid()` calls with `(SELECT auth.uid())` in policy predicates.
This wraps the function call in a subquery so PostgreSQL evaluates it once per query
rather than once per row, improving policy check performance on large tables.

Affected tables: admins, chat_reads, device_tokens, notification_reads, profiles,
project_messages, project_rating_requests, project_ratings, rating_questions,
user_push_tokens
*/

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_projects_editor_id ON projects (editor_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments (project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON corrections (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON task_updates (task_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_project_ratings_target_employee ON project_ratings (target_employee_id);
CREATE INDEX IF NOT EXISTS idx_project_ratings_rating_request ON project_ratings (rating_request_id);
CREATE INDEX IF NOT EXISTS idx_project_rating_requests_customer_email ON project_rating_requests (customer_email);
CREATE INDEX IF NOT EXISTS idx_task_templates_sort_order ON task_templates (sort_order);

-- ============ RLS POLICY OPTIMIZATION ============
-- Replace auth.uid() with (SELECT auth.uid()) to avoid per-row evaluation

-- admins
DROP POLICY IF EXISTS "main_admin_delete_admins" ON admins;
CREATE POLICY "main_admin_delete_admins" ON admins FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = 'admin'::text) AND (profiles.admin_role = 'main'::text))));

DROP POLICY IF EXISTS "main_admin_insert_admins" ON admins;
CREATE POLICY "main_admin_insert_admins" ON admins FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = 'admin'::text) AND (profiles.admin_role = 'main'::text))));

DROP POLICY IF EXISTS "main_admin_update_admins" ON admins;
CREATE POLICY "main_admin_update_admins" ON admins FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = 'admin'::text) AND (profiles.admin_role = 'main'::text))))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = 'admin'::text) AND (profiles.admin_role = 'main'::text))));

-- chat_reads
DROP POLICY IF EXISTS "select_own_chat_reads" ON chat_reads;
CREATE POLICY "select_own_chat_reads" ON chat_reads FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "insert_own_chat_reads" ON chat_reads;
CREATE POLICY "insert_own_chat_reads" ON chat_reads FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "update_own_chat_reads" ON chat_reads;
CREATE POLICY "update_own_chat_reads" ON chat_reads FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "delete_own_chat_reads" ON chat_reads;
CREATE POLICY "delete_own_chat_reads" ON chat_reads FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- device_tokens
DROP POLICY IF EXISTS "select_own_tokens" ON device_tokens;
CREATE POLICY "select_own_tokens" ON device_tokens FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "insert_own_tokens" ON device_tokens;
CREATE POLICY "insert_own_tokens" ON device_tokens FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "update_own_tokens" ON device_tokens;
CREATE POLICY "update_own_tokens" ON device_tokens FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "delete_own_tokens" ON device_tokens;
CREATE POLICY "delete_own_tokens" ON device_tokens FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- notification_reads
DROP POLICY IF EXISTS "select_own_reads" ON notification_reads;
CREATE POLICY "select_own_reads" ON notification_reads FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "insert_own_reads" ON notification_reads;
CREATE POLICY "insert_own_reads" ON notification_reads FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "update_own_reads" ON notification_reads;
CREATE POLICY "update_own_reads" ON notification_reads FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "delete_own_reads" ON notification_reads;
CREATE POLICY "delete_own_reads" ON notification_reads FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- project_messages
DROP POLICY IF EXISTS "delete_project_messages" ON project_messages;
CREATE POLICY "delete_project_messages" ON project_messages FOR DELETE
TO authenticated
USING ((sender_id = (SELECT auth.uid())) OR (get_project_role(project_id) = 'admin'::text));

DROP POLICY IF EXISTS "insert_project_messages" ON project_messages;
CREATE POLICY "insert_project_messages" ON project_messages FOR INSERT
TO authenticated
WITH CHECK ((sender_id = (SELECT auth.uid())) AND (get_project_role(project_id) IS NOT NULL));

DROP POLICY IF EXISTS "update_project_messages" ON project_messages;
CREATE POLICY "update_project_messages" ON project_messages FOR UPDATE
TO authenticated
USING ((sender_id = (SELECT auth.uid())) OR (get_project_role(project_id) = 'admin'::text))
WITH CHECK ((sender_id = (SELECT auth.uid())) OR (get_project_role(project_id) = 'admin'::text));

-- project_rating_requests
DROP POLICY IF EXISTS "prr_admin_all" ON project_rating_requests;
CREATE POLICY "prr_admin_all" ON project_rating_requests FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'admin'::text))))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'admin'::text))));

-- project_ratings
DROP POLICY IF EXISTS "pr_admin_all" ON project_ratings;
CREATE POLICY "pr_admin_all" ON project_ratings FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'admin'::text))))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'admin'::text))));

-- rating_questions
DROP POLICY IF EXISTS "rq_admin_all" ON rating_questions;
CREATE POLICY "rq_admin_all" ON rating_questions FOR ALL
TO authenticated
USING (((auth.jwt() ->> 'role'::text) = 'admin'::text) OR (EXISTS (SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'admin'::text)))))
WITH CHECK (((auth.jwt() ->> 'role'::text) = 'admin'::text) OR (EXISTS (SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'admin'::text)))));

-- user_push_tokens
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON user_push_tokens;
CREATE POLICY "Users can manage their own push tokens" ON user_push_tokens FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
