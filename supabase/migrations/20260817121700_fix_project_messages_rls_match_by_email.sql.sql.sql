/*
# Fix project_messages RLS policies to match participants by email

## Problem
The original policies compared projects.editor_id (employees.id) and
projects.customer_id (customers.id) directly against auth.uid()
(auth.users.id). These are separate UUID spaces that never overlap,
so editors and customers were always blocked from sending messages.

## Fix
Resolve the authenticated user's email from profiles, then match it
against employees.email (for the assigned editor) and
projects.customer_email (for the customer). Admins are still
identified by profiles.role = 'admin'.
*/

-- Helper: current user's email
-- (inlined via subquery on profiles)

-- SELECT: participants see non-internal messages; admin+editor see internal too
DROP POLICY IF EXISTS "select_project_messages" ON project_messages;
CREATE POLICY "select_project_messages"
ON project_messages FOR SELECT
TO authenticated
USING (
  (
    -- non-internal messages: any project participant
    NOT is_internal
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_messages.project_id
      AND (
        -- admin sees everything
        EXISTS (
          SELECT 1 FROM profiles prof
          WHERE prof.id = auth.uid() AND prof.role = 'admin'
        )
        -- assigned editor (matched by email)
        OR EXISTS (
          SELECT 1 FROM employees e
          WHERE e.id = p.editor_id
          AND e.email = (SELECT prof.email FROM profiles prof WHERE prof.id = auth.uid())
        )
        -- customer (matched by email)
        OR p.customer_email = (SELECT prof.email FROM profiles prof WHERE prof.id = auth.uid())
      )
    )
  )
  OR
  (
    -- internal messages: only admin and the assigned editor
    is_internal
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_messages.project_id
      AND (
        EXISTS (
          SELECT 1 FROM profiles prof
          WHERE prof.id = auth.uid() AND prof.role = 'admin'
        )
        OR EXISTS (
          SELECT 1 FROM employees e
          WHERE e.id = p.editor_id
          AND e.email = (SELECT prof.email FROM profiles prof WHERE prof.id = auth.uid())
        )
      )
    )
  )
);

-- INSERT: sender must be a participant, sender_id must be self,
-- and internal messages only by admin or the assigned editor
DROP POLICY IF EXISTS "insert_project_messages" ON project_messages;
CREATE POLICY "insert_project_messages"
ON project_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_messages.project_id
    AND (
      EXISTS (
        SELECT 1 FROM profiles prof
        WHERE prof.id = auth.uid() AND prof.role = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = p.editor_id
        AND e.email = (SELECT prof.email FROM profiles prof WHERE prof.id = auth.uid())
      )
      OR p.customer_email = (SELECT prof.email FROM profiles prof WHERE prof.id = auth.uid())
    )
  )
  AND (
    NOT is_internal
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_messages.project_id
      AND (
        EXISTS (
          SELECT 1 FROM profiles prof
          WHERE prof.id = auth.uid() AND prof.role = 'admin'
        )
        OR EXISTS (
          SELECT 1 FROM employees e
          WHERE e.id = p.editor_id
          AND e.email = (SELECT prof.email FROM profiles prof WHERE prof.id = auth.uid())
        )
      )
    )
  )
);

-- UPDATE: only the sender or an admin
DROP POLICY IF EXISTS "update_project_messages" ON project_messages;
CREATE POLICY "update_project_messages"
ON project_messages FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles prof
    WHERE prof.id = auth.uid() AND prof.role = 'admin'
  )
)
WITH CHECK (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles prof
    WHERE prof.id = auth.uid() AND prof.role = 'admin'
  )
);

-- DELETE: only the sender or an admin (moderation)
DROP POLICY IF EXISTS "delete_project_messages" ON project_messages;
CREATE POLICY "delete_project_messages"
ON project_messages FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles prof
    WHERE prof.id = auth.uid() AND prof.role = 'admin'
  )
);
