ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sub_order_label text;

CREATE INDEX IF NOT EXISTS idx_projects_parent_project_id ON projects(parent_project_id) WHERE parent_project_id IS NOT NULL;
