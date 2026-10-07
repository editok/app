-- Add rejected_reason column to projects for the reject/resubmit workflow
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rejected_reason text;

-- Add 'rejected' to the allowed project statuses via transition function update
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
BEGIN
  SELECT status, order_number, customer_name INTO v_current, v_order_num, v_customer
  FROM public.projects WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  UPDATE public.projects
  SET status = p_new_status, updated_at = now()
  WHERE id = p_project_id;

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
