/*
# Fix task template deletion blocked by tasks foreign key

## Problem
The `tasks.template_id` foreign key references `task_templates.id` with
`ON DELETE NO ACTION`. When a task references a template, deleting that
template fails with a foreign key constraint violation — making it
impossible to delete task templates that are in use.

## Fix
Drop the existing constraint and recreate it with `ON DELETE SET NULL`
so deleting a template sets `tasks.template_id` to NULL instead of
blocking the delete. No task data is lost.

## Security
No RLS or policy changes.
*/

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_template_id_fkey;

ALTER TABLE tasks ADD CONSTRAINT tasks_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES task_templates(id) ON DELETE SET NULL;