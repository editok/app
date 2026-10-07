/*
# EDITOK Post-Production Workflow Schema

## Overview
Creates the complete database schema for the EDITOK post-production workflow app.
This supports the full lifecycle: customer creates project → admin assigns tasks to employees → 
employee completes tasks one by one with admin approval → admin uploads review files → 
customer reviews and comments → corrections loop → customer approves → admin confirms payment → project closes.

## Tables Created
1. **customers** - Customer company profiles
2. **employees** - Employee/editor profiles  
3. **task_templates** - Reusable task templates for projects
4. **projects** - Main project/order records with full workflow status
5. **tasks** - Individual tasks within projects, assigned to employees
6. **review_files** - PDF/video files uploaded by admin for customer review
7. **comments** - Customer/admin/editor comments on review files (text, photo marks, video timestamps, voice notes)
8. **corrections** - Correction requests from customer reviews
9. **notifications** - Cross-role notification system
10. **payments** - Billing/payment tracking per project

## Security
- RLS enabled on all tables
- Policies use `TO anon, authenticated` because the app has demo credentials that use the anon key
- All data is shared/visible to all authenticated users (multi-role collaborative app)

## Notes
- All tables use uuid primary keys with gen_random_uuid()
- Timestamps default to now()
- jsonb columns store complex nested data (photo marks, video timestamps, voice notes)
- Projects have a status workflow: created → assigned → in-progress → review → correction → approved → closed
- Tasks have approval workflow: pending → in-progress → submitted → approved/rejected
*/

-- ============ CUSTOMERS ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  email text,
  phone text,
  gst text,
  address text,
  projects int DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE TO anon, authenticated USING (true);

-- ============ EMPLOYEES ============
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  skills text[] DEFAULT '{}',
  applications text[] DEFAULT '{}',
  experience text,
  rating numeric DEFAULT 5.0,
  projects int DEFAULT 0,
  status text DEFAULT 'available',
  joined date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_employees" ON employees;
CREATE POLICY "anon_select_employees" ON employees FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_employees" ON employees;
CREATE POLICY "anon_insert_employees" ON employees FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_employees" ON employees;
CREATE POLICY "anon_update_employees" ON employees FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_employees" ON employees;
CREATE POLICY "anon_delete_employees" ON employees FOR DELETE TO anon, authenticated USING (true);

-- ============ TASK_TEMPLATES ============
CREATE TABLE IF NOT EXISTS task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  description text,
  category text,
  stage text,
  priority text DEFAULT 'medium',
  estimated_hours numeric DEFAULT 8,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_task_templates" ON task_templates;
CREATE POLICY "anon_select_task_templates" ON task_templates FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_task_templates" ON task_templates;
CREATE POLICY "anon_insert_task_templates" ON task_templates FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_task_templates" ON task_templates;
CREATE POLICY "anon_update_task_templates" ON task_templates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_task_templates" ON task_templates;
CREATE POLICY "anon_delete_task_templates" ON task_templates FOR DELETE TO anon, authenticated USING (true);

-- ============ PROJECTS ============
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  event_name text NOT NULL,
  customer_id uuid REFERENCES customers(id),
  customer_email text,
  customer_name text,
  category text,
  subcategory text,
  status text DEFAULT 'created',
  priority text DEFAULT 'medium',
  deadline date,
  started_date date DEFAULT CURRENT_DATE,
  amount numeric DEFAULT 0,
  progress int DEFAULT 0,
  editor_id uuid REFERENCES employees(id),
  editor_name text,
  theme text,
  album_size text,
  photos int,
  duration text,
  editing_style text,
  source_links text,
  upload_links text,
  music_links text,
  reference_links text,
  notes text,
  created_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE TO anon, authenticated USING (true);

-- ============ TASKS ============
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  template_id uuid REFERENCES task_templates(id),
  task_name text NOT NULL,
  description text,
  stage text,
  priority text DEFAULT 'medium',
  estimated_hours numeric DEFAULT 8,
  assigned_to uuid REFERENCES employees(id),
  assigned_to_name text,
  sequence int DEFAULT 0,
  status text DEFAULT 'pending',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE TO anon, authenticated USING (true);

-- ============ REVIEW_FILES ============
CREATE TABLE IF NOT EXISTS review_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  file_type text DEFAULT 'image',
  file_url text NOT NULL,
  file_name text,
  version int DEFAULT 1,
  uploaded_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE review_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_review_files" ON review_files;
CREATE POLICY "anon_select_review_files" ON review_files FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_review_files" ON review_files;
CREATE POLICY "anon_insert_review_files" ON review_files FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_review_files" ON review_files;
CREATE POLICY "anon_update_review_files" ON review_files FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_review_files" ON review_files;
CREATE POLICY "anon_delete_review_files" ON review_files FOR DELETE TO anon, authenticated USING (true);

-- ============ COMMENTS ============
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  review_file_id uuid REFERENCES review_files(id) ON DELETE CASCADE,
  author_role text NOT NULL,
  author_name text,
  comment text NOT NULL,
  photo_mark jsonb,
  video_timestamp jsonb,
  voice_note jsonb,
  type text DEFAULT 'text',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_comments" ON comments;
CREATE POLICY "anon_select_comments" ON comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_comments" ON comments;
CREATE POLICY "anon_insert_comments" ON comments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_comments" ON comments;
CREATE POLICY "anon_update_comments" ON comments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_comments" ON comments;
CREATE POLICY "anon_delete_comments" ON comments FOR DELETE TO anon, authenticated USING (true);

-- ============ CORRECTIONS ============
CREATE TABLE IF NOT EXISTS corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  order_id text,
  event_name text,
  customer text,
  customer_email text,
  editor text,
  editor_id uuid REFERENCES employees(id),
  photo_marks jsonb DEFAULT '[]',
  video_timestamps jsonb DEFAULT '[]',
  voice_notes jsonb DEFAULT '[]',
  status text DEFAULT 'pending',
  priority text DEFAULT 'medium',
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_corrections" ON corrections;
CREATE POLICY "anon_select_corrections" ON corrections FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_corrections" ON corrections;
CREATE POLICY "anon_insert_corrections" ON corrections FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_corrections" ON corrections;
CREATE POLICY "anon_update_corrections" ON corrections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_corrections" ON corrections;
CREATE POLICY "anon_delete_corrections" ON corrections FOR DELETE TO anon, authenticated USING (true);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  description text,
  target_role text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE TO anon, authenticated USING (true);

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payments" ON payments;
CREATE POLICY "anon_select_payments" ON payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_payments" ON payments;
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_payments" ON payments;
CREATE POLICY "anon_update_payments" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_payments" ON payments;
CREATE POLICY "anon_delete_payments" ON payments FOR DELETE TO anon, authenticated USING (true);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_email);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_corrections_project ON corrections(project_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON corrections(status);
CREATE INDEX IF NOT EXISTS idx_review_files_project ON review_files(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_role, read);