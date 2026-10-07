/*
# Fix editor RLS policy for project_ratings

## Problem
The editor SELECT policy on `project_ratings` compared `target_employee_id = auth.uid()`,
but `target_employee_id` stores an `employees.id` (a separate UUID), not the auth user id.
This meant editors always saw zero rating rows, even when ratings existed for them.

## Fix
Replace the policy to match by employee email: resolve the editor's employee record
via email match against their profile, then allow SELECT where target_employee_id
matches that employee's id. This mirrors how EmployeeRatings.tsx links editors to
their employee records (by email).

## Security
- Drops and recreates the editor SELECT policy only.
- Admin policies remain unchanged.
*/

DROP POLICY IF EXISTS "pr_editor_own" ON project_ratings;

CREATE POLICY "pr_editor_own" ON project_ratings
  FOR SELECT TO authenticated
  USING (
    target_employee_id IN (
      SELECT e.id FROM employees e
      WHERE e.email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );
