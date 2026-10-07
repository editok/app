CREATE OR REPLACE FUNCTION public.emit_notification(
  p_event_key text,
  p_category text,
  p_type text,
  p_title text,
  p_description text,
  p_target_role text,
  p_target_email text,
  p_project_id uuid,
  p_metadata jsonb,
  p_send_push boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  IF p_event_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM notifications WHERE event_key = p_event_key LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  INSERT INTO notifications (
    type, title, description, target_role, target_email,
    project_id, category, event_key, metadata, read, archived_at, resolved_at
  ) VALUES (
    p_type, p_title, p_description, p_target_role, p_target_email,
    p_project_id, p_category, p_event_key, p_metadata, false, NULL, NULL
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emit_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.emit_notification TO anon;
