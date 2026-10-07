-- Update transition_project_status to also set the progress column
-- so that progress is the single source of truth for workflow stage
DROP FUNCTION IF EXISTS public.transition_project_status(uuid, text);
CREATE FUNCTION public.transition_project_status(p_project_id uuid, p_new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current text;
  v_order_num text;
  v_customer text;
  v_progress int;
BEGIN
  SELECT status, order_number, customer_name INTO v_current, v_order_num, v_customer
  FROM public.projects WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  v_progress := CASE p_new_status
    WHEN 'created' THEN 0
    WHEN 'approved' THEN 5
    WHEN 'assigned' THEN 10
    WHEN 'in-progress' THEN 30
    WHEN 'finished' THEN 50
    WHEN 'review' THEN 60
    WHEN 'correction' THEN 70
    WHEN 'correction_approved' THEN 80
    WHEN 'invoiced' THEN 90
    WHEN 'completed' THEN 100
    ELSE NULL
  END;

  IF v_progress IS NOT NULL THEN
    UPDATE public.projects
    SET status = p_new_status, progress = v_progress, updated_at = now()
    WHERE id = p_project_id;
  ELSE
    UPDATE public.projects
    SET status = p_new_status, updated_at = now()
    WHERE id = p_project_id;
  END IF;

  INSERT INTO public.notifications (type, title, description, target_role, read, project_id)
  VALUES (
    'project',
    'Project status updated',
    v_order_num || ' - ' || v_customer || ' status changed to ' || p_new_status,
    'admin',
    false,
    p_project_id
  );
END;
$$;
