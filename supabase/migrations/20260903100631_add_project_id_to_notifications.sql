ALTER TABLE notifications ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON notifications(project_id) WHERE project_id IS NOT NULL;
