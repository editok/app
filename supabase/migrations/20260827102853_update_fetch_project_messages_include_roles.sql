/*
# Update fetch_project_messages to include sender role + admin_role

The chat now displays role labels (Admin, Manager, Finance Admin, Editor,
Customer) instead of usernames. The RPC function must return `role` and
`admin_role` in the sender JSON so the frontend can render the correct label.
*/

CREATE OR REPLACE FUNCTION public.fetch_project_messages(p_project_id uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  sender_id uuid,
  message text,
  is_internal boolean,
  created_at timestamptz,
  sender jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_project_role(p_project_id);
  IF v_role IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pm.id,
    pm.project_id,
    pm.sender_id,
    pm.message,
    pm.is_internal,
    pm.created_at,
    COALESCE(
      jsonb_build_object(
        'id', prof.id,
        'email', prof.email,
        'full_name', prof.full_name,
        'avatar_url', prof.avatar_url,
        'role', prof.role,
        'admin_role', prof.admin_role
      ),
      jsonb_build_object('id', pm.sender_id, 'email', null, 'full_name', null, 'avatar_url', null, 'role', null, 'admin_role', null)
    ) AS sender
  FROM project_messages pm
  LEFT JOIN profiles prof ON prof.id = pm.sender_id
  WHERE pm.project_id = p_project_id
    AND (
      NOT pm.is_internal
      OR v_role IN ('admin', 'editor')
    )
  ORDER BY pm.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_project_messages(uuid) TO authenticated;
