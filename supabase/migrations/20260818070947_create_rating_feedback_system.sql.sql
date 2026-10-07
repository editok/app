/*
# Rating & Customer Feedback System

Adds a complete project-based rating and feedback module to the existing
application. It supports:
- Admin-managed rating questions (targeted at SYSTEM, ROLE, TASK, EMPLOYEE, or PROJECT)
- Customer review requests triggered when a project is completed/approved
- Snapshot-based ratings (employee id captured at submission time)
- Employee performance analytics (by task, by project)
- System-level rating aggregation separate from employee ratings

## New Tables
### rating_questions
Admin-defined questions that drive the customer rating form.
- question: the title the customer sees (e.g. "Color Correction")
- description / helper text
- rating_type: 'star' (default) — kept as text for future types
- max_rating: default 5
- comment_enabled, comment_required
- target_type: 'SYSTEM' | 'ROLE' | 'TASK' | 'EMPLOYEE' | 'PROJECT'
- target_role: free text role name for ROLE targets (e.g. "Customer Relation Officer")
- target_task_name: free text task name for TASK targets (matched against tasks.task_name)
- status: 'active' | 'inactive'
- sort_order: for display ordering

### project_rating_requests
One per completed project, links the customer to a feedback submission flow.
- project_id, customer_id, customer_email
- status: 'pending' (awaiting customer) | 'submitted' | 'expired'
- submitted_at: timestamp when the customer submitted feedback
- Unique on project_id so a customer can only submit once per project.

### project_ratings
Individual rating records. One per question per review submission.
- rating_request_id, project_id, question_id
- rating (numeric), comment (text)
- target_type (snapshot of the question's target type)
- target_employee_id (snapshot — the employee who completed the task / held the role at submission time; NULL for SYSTEM targets)
- target_role (snapshot for ROLE targets)
- target_task_id (snapshot for TASK targets)
- target_task_name (snapshot for TASK targets)
- customer_email (denormalized for filtering)
Unique on (rating_request_id, question_id) prevents duplicate answers.

## Security (RLS)
This app uses sign-in (authenticated roles). Policies:
- rating_questions: admin full CRUD; editors and customers SELECT only (so the customer form can read active questions).
- project_rating_requests: customers SELECT/UPDATE only their own (by customer_email = auth.jwt email); admin full CRUD; editors SELECT their own project's requests.
- project_ratings: customers INSERT only their own and SELECT only their own; admin full CRUD; editors SELECT ratings where the target_employee_id matches their employee id (so they can see their own feedback).

## Seed Data
Inserts the six default questions (Communication, Application Accessibility, Color Correction, Layout & Sequence, Review System, Overall Experience) with sort_order 1-6.
*/

-- ============ rating_questions ============
CREATE TABLE IF NOT EXISTS rating_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  description text,
  rating_type text NOT NULL DEFAULT 'star',
  max_rating integer NOT NULL DEFAULT 5,
  comment_enabled boolean NOT NULL DEFAULT true,
  comment_required boolean NOT NULL DEFAULT false,
  target_type text NOT NULL DEFAULT 'SYSTEM',
  target_role text,
  target_task_name text,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rating_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rq_admin_all" ON rating_questions;
CREATE POLICY "rq_admin_all"
ON rating_questions FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "rq_read_non_admin" ON rating_questions;
CREATE POLICY "rq_read_non_admin"
ON rating_questions FOR SELECT
TO authenticated
USING (status = 'active');

-- ============ project_rating_requests ============
CREATE TABLE IF NOT EXISTS project_rating_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  UNIQUE (project_id)
);

ALTER TABLE project_rating_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prr_admin_all" ON project_rating_requests;
CREATE POLICY "prr_admin_all"
ON project_rating_requests FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "prr_customer_own" ON project_rating_requests;
CREATE POLICY "prr_customer_own"
ON project_rating_requests FOR SELECT
TO authenticated
USING (customer_email = (SELECT email FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "prr_customer_update_own" ON project_rating_requests;
CREATE POLICY "prr_customer_update_own"
ON project_rating_requests FOR UPDATE
TO authenticated
USING (customer_email = (SELECT email FROM profiles WHERE id = auth.uid()))
WITH CHECK (customer_email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- ============ project_ratings ============
CREATE TABLE IF NOT EXISTS project_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_request_id uuid NOT NULL REFERENCES project_rating_requests(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES rating_questions(id) ON DELETE CASCADE,
  rating numeric NOT NULL,
  comment text,
  target_type text NOT NULL,
  target_employee_id uuid,
  target_role text,
  target_task_id uuid,
  target_task_name text,
  customer_email text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (rating_request_id, question_id)
);

ALTER TABLE project_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pr_admin_all" ON project_ratings;
CREATE POLICY "pr_admin_all"
ON project_ratings FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "pr_customer_insert_own" ON project_ratings;
CREATE POLICY "pr_customer_insert_own"
ON project_ratings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM project_rating_requests r WHERE r.id = rating_request_id AND r.customer_email = (SELECT email FROM profiles WHERE id = auth.uid()))
);

DROP POLICY IF EXISTS "pr_customer_select_own" ON project_ratings;
CREATE POLICY "pr_customer_select_own"
ON project_ratings FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM project_rating_requests r WHERE r.id = rating_request_id AND r.customer_email = (SELECT email FROM profiles WHERE id = auth.uid()))
);

DROP POLICY IF EXISTS "pr_editor_own" ON project_ratings;
CREATE POLICY "pr_editor_own"
ON project_ratings FOR SELECT
TO authenticated
USING (target_employee_id = auth.uid());

-- ============ Seed default questions ============
INSERT INTO rating_questions (question, description, rating_type, max_rating, comment_enabled, comment_required, target_type, target_role, target_task_name, status, sort_order)
VALUES
  ('Communication', 'How was our communication and support?', 'star', 5, true, false, 'ROLE', 'Customer Relation Officer', NULL, 'active', 1),
  ('Application Accessibility', 'How easy was it to use our application?', 'star', 5, true, false, 'SYSTEM', NULL, NULL, 'active', 2),
  ('Color Correction', 'How satisfied are you with the color correction?', 'star', 5, true, false, 'TASK', NULL, 'Color Correction', 'active', 3),
  ('Layout & Sequence', 'How satisfied are you with the layout and photo sequence?', 'star', 5, true, false, 'TASK', NULL, 'Layout & Sequence', 'active', 4),
  ('Review System', 'How was your experience reviewing the project and giving corrections?', 'star', 5, true, false, 'SYSTEM', NULL, NULL, 'active', 5),
  ('Overall Experience', 'How was your overall experience?', 'star', 5, true, false, 'SYSTEM', NULL, NULL, 'active', 6)
ON CONFLICT DO NOTHING;
