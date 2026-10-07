/*
# Create project_messages table for project-based chat

## Purpose
Adds a real-time project messaging system so Admin, Editor, and Customer
can discuss a specific project. Includes an `is_internal` flag so Admins
and Editors can exchange private messages that the Customer cannot see.

## 1. New Table: project_messages
- `id` (uuid, primary key, defaults to gen_random_uuid())
- `project_id` (uuid, NOT NULL, references projects(id) ON DELETE CASCADE)
- `sender_id` (uuid, NOT NULL, references profiles(id) ON DELETE CASCADE)
- `message` (text, NOT NULL)
- `is_internal` (boolean, NOT NULL, default false)
  - true  => private Admin/Editor note (Customer cannot see it)
  - false => visible to all project participants
- `created_at` (timestamptz, defaults to now())

## 2. Indexes
- `idx_project_messages_project_id` on `project_id` for fast per-project loads
- `idx_project_messages_created_at` on `created_at` for chronological ordering

## 3. Security: Row Level Security
RLS is enabled on project_messages. The app has a sign-in screen, so all
policies are scoped to `TO authenticated` and use `auth.uid()`.

A user is a "participant" of a project if ANY of these are true:
  a) Their profile role is 'admin' (admins see every project).
  b) They are the assigned editor (projects.editor_id = auth.uid()).
  c) They are the customer (projects.customer_id = auth.uid()).

### SELECT policy
- Non-internal messages: visible to any project participant.
- Internal messages: visible only to admin and the assigned editor
  (customer_id users are excluded).

### INSERT policy
- Sender must be a participant of the project.
- Sender_id must equal auth.uid() (cannot spoof another sender).
- Internal messages can only be created by admin or the assigned editor
  (WITH CHECK enforces this).

All four CRUD verbs have separate policies (no FOR ALL).

## 4. Notes
- No UPDATE/DELETE restrictions beyond ownership; messages are generally
  immutable. DELETE is allowed for the sender or an admin for moderation.
- The policies reference projects and profiles via EXISTS subqueries so
  access is derived from live project assignments, not a stale snapshot.
*/

CREATE TABLE IF NOT EXISTS project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_messages_project_id
  ON project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created_at
  ON project_messages(created_at);

ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
-- (inlined in policies to avoid function-dependency edge cases)

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
        p.editor_id = auth.uid()
        OR p.customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles prof
          WHERE prof.id = auth.uid() AND prof.role = 'admin'
        )
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
        p.editor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles prof
          WHERE prof.id = auth.uid() AND prof.role = 'admin'
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
      p.editor_id = auth.uid()
      OR p.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles prof
        WHERE prof.id = auth.uid() AND prof.role = 'admin'
      )
    )
  )
  AND (
    NOT is_internal
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_messages.project_id
      AND (
        p.editor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles prof
          WHERE prof.id = auth.uid() AND prof.role = 'admin'
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
