-- Recompute project progress and status when tasks change
-- This trigger fires AFTER INSERT/UPDATE/DELETE on tasks and updates the parent project's progress column
-- so that all pages subscribing to the projects realtime channel get fresh progress automatically.

CREATE OR REPLACE FUNCTION public.recompute_project_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  v_total int;
  v_done int;
  v_progress int;
  v_all_approved boolean;
  v_any_in_progress boolean;
  v_current_status text;
BEGIN
  -- Determine the project ID from the row
  IF TG_OP = 'DELETE' THEN
    v_project_id := OLD.project_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;

  IF v_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Count tasks and done tasks
  SELECT count(*), count(*) FILTER (
    WHERE status IN ('approved', 'completed', 'submitted', 'fully-completed', 'partial-completed')
  )
  INTO v_total, v_done
  FROM public.tasks
  WHERE project_id = v_project_id;

  -- Compute progress percentage
  IF v_total = 0 THEN
    v_progress := 0;
  ELSE
    v_progress := round((v_done::numeric / v_total) * 100);
  END IF;

  -- Check if all tasks are approved/completed
  SELECT bool_and(status IN ('approved', 'completed')) INTO v_all_approved
  FROM public.tasks
  WHERE project_id = v_project_id;

  -- Check if any task is in-progress or beyond
  SELECT bool_or(status IN ('in-progress', 'partial-completed', 'fully-completed', 'submitted', 'approved', 'completed'))
  INTO v_any_in_progress
  FROM public.tasks
  WHERE project_id = v_project_id;

  -- Get current project status
  SELECT status INTO v_current_status FROM public.projects WHERE id = v_project_id;

  -- Auto-advance project status based on task states
  -- Only auto-advance if not already in a later stage (review, invoiced, completed)
  IF v_all_approved AND v_total > 0 AND v_current_status IN ('created', 'approved', 'assigned', 'in-progress', 'finished') THEN
    UPDATE public.projects
    SET progress = 100, status = 'finished', updated_at = now()
    WHERE id = v_project_id;
  ELSIF v_any_in_progress AND v_current_status IN ('created', 'approved', 'assigned') THEN
    UPDATE public.projects
    SET progress = greatest(v_progress, 30), status = 'in-progress', updated_at = now()
    WHERE id = v_project_id;
  ELSE
    -- Just update progress
    UPDATE public.projects
    SET progress = v_progress, updated_at = now()
    WHERE id = v_project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tasks_recompute_project_progress ON tasks;
CREATE TRIGGER tasks_recompute_project_progress
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_project_progress();
