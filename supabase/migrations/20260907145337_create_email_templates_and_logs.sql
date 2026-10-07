/*
# Create email_templates and email_logs tables

1. New Tables
- `email_templates` — stores customizable automated email templates
  - id (uuid, PK)
  - template_name (text, unique, not null) — e.g. "Customer Welcome"
  - display_name (text, not null) — human-friendly label shown in UI
  - subject (text, not null) — email subject line with variable placeholders
  - body_content (text, not null) — email body with variable placeholders
  - target_role (text, not null) — 'customer', 'editor', or 'admin'
  - available_variables (text[], not null) — list of {{variables}} valid for this template
  - enabled (boolean, default true) — can be toggled off
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())

- `email_logs` — logs every triggered email for audit/verification
  - id (uuid, PK)
  - template_name (text, not null) — which template was triggered
  - recipient_email (text, not null)
  - recipient_name (text)
  - subject (text, not null)
  - body_content (text, not null) — rendered body with variables replaced
  - variables (jsonb) — the variable data passed to the template
  - status (text, default 'logged') — 'logged', 'sent', 'failed'
  - created_at (timestamptz, default now())

2. Seed Data
- 18 default templates across Customer, Editor, and Admin roles
- Each template has subject, body, and available_variables populated

3. Security
- RLS enabled on both tables
- Allow anon + authenticated CRUD (shared business data, same as other tables)
*/

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  subject text NOT NULL,
  body_content text NOT NULL,
  target_role text NOT NULL DEFAULT 'customer',
  available_variables text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_email_templates" ON email_templates;
CREATE POLICY "anon_select_email_templates" ON email_templates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_email_templates" ON email_templates;
CREATE POLICY "anon_insert_email_templates" ON email_templates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_email_templates" ON email_templates;
CREATE POLICY "anon_update_email_templates" ON email_templates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_email_templates" ON email_templates;
CREATE POLICY "anon_delete_email_templates" ON email_templates FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  body_content text NOT NULL,
  variables jsonb,
  status text NOT NULL DEFAULT 'logged',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_email_logs" ON email_logs;
CREATE POLICY "anon_select_email_logs" ON email_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_email_logs" ON email_logs;
CREATE POLICY "anon_insert_email_logs" ON email_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_email_logs" ON email_logs;
CREATE POLICY "anon_update_email_logs" ON email_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_email_logs" ON email_logs;
CREATE POLICY "anon_delete_email_logs" ON email_logs FOR DELETE
  TO anon, authenticated USING (true);

-- Seed: Customer templates
INSERT INTO email_templates (template_name, display_name, subject, body_content, target_role, available_variables) VALUES
('customer_welcome', 'Customer Welcome', 'Welcome to EDITOK, {{customer_name}}!', 'Hi {{customer_name}},\n\nWelcome to EDITOK Post Production! Your account has been created and you can now submit projects, track orders, and collaborate with our team.\n\nSign in with your email: {{customer_email}}\n\nIf you have any questions, feel free to reach out.\n\nBest regards,\nThe EDITOK Team', 'customer', ARRAY['{{customer_name}}','{{customer_email}}']),
('order_confirmation', 'Order Confirmation', 'Order Confirmed — {{project_name}} ({{order_number}})', 'Hi {{customer_name}},\n\nYour order has been confirmed!\n\nOrder: {{order_number}}\nProject: {{project_name}}\nCategory: {{category}}\nPhotos: {{photo_count}}\nDeadline: {{deadline}}\n\nWe''ll keep you updated as your project progresses.\n\nBest regards,\nThe EDITOK Team', 'customer', ARRAY['{{customer_name}}','{{order_number}}','{{project_name}}','{{category}}','{{photo_count}}','{{deadline}}']),
('review_ready', 'Review Ready (Proof Link)', 'Your proofs are ready for review — {{project_name}}', 'Hi {{customer_name}},\n\nYour proofs for "{{project_name}}" ({{order_number}}) are now ready for review.\n\nReview them here: {{proof_link}}\n\nPlease provide your feedback at your earliest convenience.\n\nBest regards,\nThe EDITOK Team', 'customer', ARRAY['{{customer_name}}','{{project_name}}','{{order_number}}','{{proof_link}}']),
('project_approved', 'Project Approved', 'Project Approved — {{project_name}}', 'Hi {{customer_name}},\n\nYour project "{{project_name}}" ({{order_number}}) has been approved. The final files will be delivered shortly.\n\nThank you for choosing EDITOK!\n\nBest regards,\nThe EDITOK Team', 'customer', ARRAY['{{customer_name}}','{{project_name}}','{{order_number}}']),
('payment_confirmation', 'Payment Confirmation', 'Payment Received — {{project_name}}', 'Hi {{customer_name}},\n\nWe''ve received your payment for "{{project_name}}" ({{order_number}}).\n\nAmount: {{amount}}\n\nThank you for your business!\n\nBest regards,\nThe EDITOK Team', 'customer', ARRAY['{{customer_name}}','{{project_name}}','{{order_number}}','{{amount}}']),
('rating_request', 'Rating Request', 'How was your experience with EDITOK?', 'Hi {{customer_name}},\n\nYour project "{{project_name}}" is complete! We''d love to hear your feedback.\n\nPlease rate your experience: {{rating_link}}\n\nIt only takes a minute and helps us improve.\n\nBest regards,\nThe EDITOK Team', 'customer', ARRAY['{{customer_name}}','{{project_name}}','{{rating_link}}']),
('new_message', 'New Message', 'New message on {{project_name}}', 'Hi {{customer_name}},\n\nYou have a new message on your project "{{project_name}}" ({{order_number}}).\n\nFrom: {{sender_name}}\nMessage: {{message_preview}}\n\nView full conversation in your EDITOK dashboard.\n\nBest regards,\nThe EDITOK Team', 'customer', ARRAY['{{customer_name}}','{{project_name}}','{{order_number}}','{{sender_name}}','{{message_preview}}'])
ON CONFLICT (template_name) DO NOTHING;

-- Seed: Editor templates
INSERT INTO email_templates (template_name, display_name, subject, body_content, target_role, available_variables) VALUES
('editor_welcome', 'Editor Welcome', 'Welcome to the EDITOK team, {{editor_name}}!', 'Hi {{editor_name}},\n\nWelcome to EDITOK Post Production! Your editor account has been created.\n\nSign in with:\nEmail: {{editor_email}}\nPassword: {{editor_password}}\n\nOnce logged in, you''ll see available projects in your dashboard. If you have any questions, reach out to your manager.\n\nBest regards,\nThe EDITOK Team', 'editor', ARRAY['{{editor_name}}','{{editor_email}}','{{editor_password}}']),
('task_assigned', 'Task Assigned/Unlocked', 'New task assigned — {{task_name}} on {{project_name}}', 'Hi {{editor_name}},\n\nA new task has been assigned to you:\n\nTask: {{task_name}}\nProject: {{project_name}} ({{order_number}})\nPriority: {{priority}}\nEstimated hours: {{estimated_hours}}\n\nDownload links: {{download_links}}\n\nPlease pick up the task from your dashboard.\n\nBest regards,\nThe EDITOK Team', 'editor', ARRAY['{{editor_name}}','{{task_name}}','{{project_name}}','{{order_number}}','{{priority}}','{{estimated_hours}}','{{download_links}}']),
('deadline_reminder', 'Deadline Reminder', 'Deadline approaching — {{project_name}}', 'Hi {{editor_name}},\n\nThis is a reminder that the deadline for "{{project_name}}" ({{order_number}}) is approaching.\n\nDeadline: {{deadline}}\nTask: {{task_name}}\n\nPlease ensure your work is submitted on time.\n\nBest regards,\nThe EDITOK Team', 'editor', ARRAY['{{editor_name}}','{{project_name}}','{{order_number}}','{{deadline}}','{{task_name}}']),
('correction_received', 'Correction Received', 'Corrections requested — {{project_name}}', 'Hi {{editor_name}},\n\nCorrections have been requested for "{{project_name}}" ({{order_number}}).\n\nNumber of corrections: {{correction_count}}\n\nPlease review the correction details in your dashboard and address them promptly.\n\nBest regards,\nThe EDITOK Team', 'editor', ARRAY['{{editor_name}}','{{project_name}}','{{order_number}}','{{correction_count}}']),
('task_approved', 'Task Approved', 'Task approved — {{task_name}}', 'Hi {{editor_name}},\n\nYour task "{{task_name}}" on "{{project_name}}" ({{order_number}}) has been approved. The next stage is now available.\n\nUpload links for the next stage: {{upload_links}}\n\nGreat work!\n\nBest regards,\nThe EDITOK Team', 'editor', ARRAY['{{editor_name}}','{{task_name}}','{{project_name}}','{{order_number}}','{{upload_links}}']),
('payout_processed', 'Payout Processed', 'Payout processed — {{amount}}', 'Hi {{editor_name}},\n\nYour payout has been processed.\n\nAmount: {{amount}}\nProject: {{project_name}} ({{order_number}})\nTask: {{task_name}}\n\nYou can view your full earnings history in your Earnings page.\n\nBest regards,\nThe EDITOK Team', 'editor', ARRAY['{{editor_name}}','{{amount}}','{{project_name}}','{{order_number}}','{{task_name}}'])
ON CONFLICT (template_name) DO NOTHING;

-- Seed: Admin templates
INSERT INTO email_templates (template_name, display_name, subject, body_content, target_role, available_variables) VALUES
('admin_new_order', 'New Order', 'New order placed — {{order_number}}', 'Hello,\n\nA new order has been placed.\n\nOrder: {{order_number}}\nProject: {{project_name}}\nCustomer: {{customer_name}}\nCategory: {{category}}\nPhotos: {{photo_count}}\nDeadline: {{deadline}}\n\nPlease assign it to an editor at your earliest convenience.\n\nEDITOK System', 'admin', ARRAY['{{order_number}}','{{project_name}}','{{customer_name}}','{{category}}','{{photo_count}}','{{deadline}}']),
('admin_task_review', 'Task Ready for Review', 'Task ready for review — {{task_name}}', 'Hello,\n\nA task has been submitted for review.\n\nProject: {{project_name}} ({{order_number}})\nTask: {{task_name}}\nEditor: {{editor_name}}\nSubmitted: {{submitted_at}}\n\nPlease review and approve or request corrections.\n\nEDITOK System', 'admin', ARRAY['{{project_name}}','{{order_number}}','{{task_name}}','{{editor_name}}','{{submitted_at}}']),
('admin_client_feedback', 'Client Feedback Submitted', 'Client feedback submitted — {{project_name}}', 'Hello,\n\nFeedback has been submitted by a client.\n\nProject: {{project_name}} ({{order_number}})\nCustomer: {{customer_name}}\nFeedback: {{feedback_summary}}\n\nPlease review the feedback in the corrections dashboard.\n\nEDITOK System', 'admin', ARRAY['{{project_name}}','{{order_number}}','{{customer_name}}','{{feedback_summary}}'])
ON CONFLICT (template_name) DO NOTHING;