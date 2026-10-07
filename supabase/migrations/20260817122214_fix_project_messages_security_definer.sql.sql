/*
# Fix project_messages: SECURITY DEFINER participation check

## Problem
The email-matching RLS policies run subqueries against employees and
profiles, both of which have RLS enabled. Nested RLS evaluation inside
policy subqueries can silently filter rows and cause the EXISTS check
to fail even when the data matches, so editors get "failed to send
message" errors.

## Fix
Create a SECURITY DEFINER function that checks project participation
using the owner's privileges (bypassing RLS on referenced tables).
The policies call this function instead of inlining subqueries.

This is the recommended Supabase pattern for participation checks
that span multiple RLS-protected tables.
*/

-- Drop old policies that inline subqueries
DROP POLICY IF EXISTS "select_project_messages" ON project_messages;
DROP POLICY IF EXISTS "insert_project_messages" ON project_messages;
DROP POLICY IF EXISTS "update_project_messages" ON project_messages;
DROP POLICY IF EXISTS "delete_project_messages" ON project_messages;

-- SECURITY DEFINER function: is the current user a participant of this project?
-- Returns: 'admin' | 'editor' | 'customer' | NULL
-- Bypasses RLS so it can read employees, profiles, and projects freely.
CREATE OR REPLACE FUNCTION public.get_project_role(p_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_role text;
  v_editor_email text;
  v_customer_email text;
BEGIN
  -- Get current user's email and role from profiles
  SELECT prof.email, prof.role INTO v_email, v_role
  FROM profiles prof
  WHERE prof.id = auth.uid();

  IF v_role IS NULL THEN
    RETURN NULL;
  END IF;

  -- Admins participate in everything
  IF v_role = 'admin' THEN
    RETURN 'admin';
  END IF;

  -- Get the project's editor email and customer email
  SELECT
    e.email,
    p.customer_email
  INTO v_editor_email, v_customer_email
  FROM projects p
  LEFT JOIN employees e ON e.id = p.editor_id
  WHERE p.id = p_project_id;

  -- Check if assigned editor (match by email)
  IF v_email IS NOT NULL AND v_editor_email IS NOT NULL AND v_email = v_editor_email THEN
    RETURN 'editor';
  END IF;

  -- Check if customer (match by email)
  IF v_email IS NOT NULL AND v_customer_email IS NOT NULL AND v_email = v_customer_email THEN
    RETURN 'customer';
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_role(uuid) TO authenticated;

-- SELECT: non-internal visible to any participant; internal to admin+editor only
CREATE POLICY "select_project_messages"
ON project_messages FOR SELECT
TO authenticated
USING (
  (
    NOT is_internal
    AND public.get_project_role(project_messages.project_id) IS NOT NULL
  )
  OR
  (
    is_internal
    AND public.get_project_role(project_messages.project_id) IN ('admin', 'editor')
  )
);

-- INSERT: sender must be a participant, sender_id must be self,
-- internal messages only by admin or editor
CREATE POLICY "insert_project_messages"
ON project_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.get_project_role(project_messages.project_id) IS NOT NULL
  AND (
    NOT is_internal
    OR public.get_project_role(project_messages.project_id) IN ('admin', 'editor')
  )
);

-- UPDATE: only the sender or an admin
CREATE POLICY "update_project_messages"
ON project_messages FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
  OR public.get_project_role(project_messages.project_id) = 'admin'
)
WITH CHECK (
  sender_id = auth.uid()
  OR public.get_project_role(project_messages.project_id) = 'admin'
);

-- DELETE: only the sender or an admin
CREATE POLICY "delete_project_messages"
ON project_messages FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
  OR public.get_project_role(project_messages.project_id) = 'admin'
);
