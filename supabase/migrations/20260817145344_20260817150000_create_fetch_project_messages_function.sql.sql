/*
# Fix project chat: SECURITY DEFINER function to fetch messages with sender info

## Problem
The project chat fetches messages with a join to `profiles` to display sender
names. The `profiles` table has RLS that only lets users read their OWN row.
When a customer (or editor) loads the chat, the join to the admin's and other
participants' profile rows is blocked by RLS, so the query returns an error
and the chat appears empty — even though the messages exist and the RLS
policies on `project_messages` correctly allow the customer to see them.

## Fix
Create a SECURITY DEFINER function `fetch_project_messages(p_project_id uuid)`
that:
1. Verifies the caller is a participant of the project (reuses the existing
   `get_project_role` function).
2. Returns all non-internal messages the caller is allowed to see, plus
   internal messages only if the caller is admin or editor.
3. Joins to `profiles` using the owner's privileges (bypassing profiles RLS)
   so sender name/email is always available.

The function returns the same shape the frontend expects: message columns
plus a nested `sender` object with `id`, `email`, `full_name`, `avatar_url`.

## Security
- SECURITY DEFINER: runs with the function owner's privileges, bypassing RLS
  on `profiles`. This is safe because the function only exposes the minimal
  sender fields needed for chat display (name, email, avatar).
- Participation is enforced via the existing `get_project_role` function.
- Internal messages are only returned to admin/editor roles.
- Granted to `authenticated` only.
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
        'avatar_url', prof.avatar_url
      ),
      jsonb_build_object('id', pm.sender_id, 'email', null, 'full_name', null, 'avatar_url', null)
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