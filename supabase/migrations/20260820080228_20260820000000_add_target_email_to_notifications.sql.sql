ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_email text;
CREATE INDEX IF NOT EXISTS idx_notifications_target_email ON notifications(target_role, target_email, read);