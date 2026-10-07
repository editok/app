/*
# Link historical task notifications to projects

1. Purpose
- Repair older task notifications that were saved without a project link.
- Move task assignment, task pickup, and task approval alerts into the Task category.

2. Modified table
- `notifications.project_id`: populated only when a notification has one unambiguous matching project.
- `notifications.type`: task assignment and pickup records become `task-assigned`; task approval records become `task-approved`.
- `notifications.category`: set to `task` for the repaired records.

3. Matching rules
- Assignment and pickup messages are matched against the project event name in their description, choosing the closest project creation time.
- Approval messages are matched against the task name inside the description and the closest task creation time within one day.
- Records with ambiguous matches are deliberately left unchanged to prevent linking an alert to the wrong project.

4. Security
- No tables, permissions, or row-level security policies are changed.
- This migration only updates existing notification classification and project references.
*/

WITH project_candidates AS (
  SELECT
    n.id AS notification_id,
    p.id AS project_id,
    row_number() OVER (
      PARTITION BY n.id
      ORDER BY abs(extract(epoch FROM (n.created_at - p.created_at)))
    ) AS match_rank,
    count(*) OVER (PARTITION BY n.id) AS candidate_count
  FROM public.notifications n
  JOIN public.projects p
    ON n.description ILIKE '%' || p.event_name || '%'
  WHERE n.project_id IS NULL
    AND n.title IN ('New task group assigned', 'New task assigned', 'Task picked up')
), project_matches AS (
  SELECT notification_id, project_id
  FROM project_candidates
  WHERE match_rank = 1
    AND candidate_count = 1
)
UPDATE public.notifications n
SET
  project_id = m.project_id,
  type = 'task-assigned',
  category = 'task'
FROM project_matches m
WHERE n.id = m.notification_id;

WITH approval_candidates AS (
  SELECT
    n.id AS notification_id,
    t.project_id,
    row_number() OVER (
      PARTITION BY n.id
      ORDER BY abs(extract(epoch FROM (n.created_at - t.created_at)))
    ) AS match_rank,
    count(*) OVER (PARTITION BY n.id) AS candidate_count
  FROM public.notifications n
  JOIN public.tasks t
    ON t.task_name = substring(n.description FROM 'Admin approved "([^"]+)"')
   AND abs(extract(epoch FROM (n.created_at - t.created_at))) <= 86400
  WHERE n.project_id IS NULL
    AND n.title = 'Task approved'
), approval_matches AS (
  SELECT notification_id, project_id
  FROM approval_candidates
  WHERE match_rank = 1
    AND candidate_count = 1
)
UPDATE public.notifications n
SET
  project_id = m.project_id,
  type = 'task-approved',
  category = 'task'
FROM approval_matches m
WHERE n.id = m.notification_id;
