-- Restrict admins table writes to Main Admins only
-- SELECT remains open to authenticated users (admins list is visible to all admin roles)
-- INSERT/UPDATE/DELETE restricted to profiles where role='admin' AND admin_role='main'

-- Drop existing permissive policies
DROP POLICY IF EXISTS "anon_insert_admins" ON admins;
DROP POLICY IF EXISTS "anon_update_admins" ON admins;
DROP POLICY IF EXISTS "anon_delete_admins" ON admins;

-- INSERT: only main admins
CREATE POLICY "main_admin_insert_admins" ON admins
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.admin_role = 'main'
    )
  );

-- UPDATE: only main admins
CREATE POLICY "main_admin_update_admins" ON admins
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.admin_role = 'main'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.admin_role = 'main'
    )
  );

-- DELETE: only main admins
CREATE POLICY "main_admin_delete_admins" ON admins
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.admin_role = 'main'
    )
  );
