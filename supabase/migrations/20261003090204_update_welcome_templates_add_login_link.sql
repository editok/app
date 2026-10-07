/*
# Update welcome email templates with login link

1. Modified templates:
   - `editor_welcome` — add {{login_link}} variable and include it in the body
   - `customer_welcome` — add {{login_link}} variable and include it in the body

2. New templates:
   - `admin_welcome` — welcome email for new admin users with login link
*/

-- Update editor_welcome to include login link
UPDATE email_templates
SET body_content = 'Hi {{editor_name}},\n\nWelcome to EDITOK Post Production! Your editor account has been created.\n\nSign in with:\nEmail: {{editor_email}}\nPassword: {{editor_password}}\n\nLogin here: {{login_link}}\n\nOnce logged in, you''ll see available projects in your dashboard. If you have any questions, reach out to your manager.\n\nBest regards,\nThe EDITOK Team',
    available_variables = ARRAY['{{editor_name}}','{{editor_email}}','{{editor_password}}','{{login_link}}'],
    updated_at = now()
WHERE template_name = 'editor_welcome';

-- Update customer_welcome to include login link
UPDATE email_templates
SET body_content = 'Hi {{customer_name}},\n\nWelcome to EDITOK Post Production! Your account has been created and you can now submit projects, track orders, and collaborate with our team.\n\nSign in with your email: {{customer_email}}\nLogin here: {{login_link}}\n\nIf you have any questions, feel free to reach out.\n\nBest regards,\nThe EDITOK Team',
    available_variables = ARRAY['{{customer_name}}','{{customer_email}}','{{login_link}}'],
    updated_at = now()
WHERE template_name = 'customer_welcome';

-- Create admin_welcome template
INSERT INTO email_templates (template_name, display_name, subject, body_content, target_role, available_variables)
VALUES (
  'admin_welcome',
  'Admin Welcome',
  'Welcome to the EDITOK admin team, {{editor_name}}!',
  'Hi {{editor_name}},\n\nYour admin account has been created for EDITOK Post Production.\n\nSign in with:\nEmail: {{editor_email}}\nPassword: {{editor_password}}\n\nLogin here: {{login_link}}\n\nYou can manage projects, customers, editors, and more from your dashboard.\n\nBest regards,\nThe EDITOK Team',
  'admin',
  ARRAY['{{editor_name}}','{{editor_email}}','{{editor_password}}','{{login_link}}']
)
ON CONFLICT (template_name) DO NOTHING;
