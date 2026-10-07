/*
# Create admins table for admin user management

1. New Tables
- `admins` — stores admin-specific business data, separate from auth profiles
  - id (uuid, PK, default gen_random_uuid())
  - name (text, not null) — admin's full name
  - email (text, unique) — used to link to auth profile
  - phone (text, nullable) — contact phone
  - admin_role (text, not null, default 'manager') — 'main', 'manager', or 'finance'
  - status (text, not null, default 'active') — 'active' or 'inactive'
  - allowed_menus (text[], nullable) — restricted menu keys, null = full access
  - created_at (timestamptz, default now())

2. Data Migration
- Populate admins table from existing profiles where role = 'admin'
- Uses ON CONFLICT (email) DO NOTHING to be idempotent

3. Security
- Enable RLS on admins table
- Allow anon + authenticated CRUD (same pattern as customers and employees tables)
- This is a shared/internal business-data table, not user-scoped

4. Important Notes
- The profiles table still handles authentication (role, admin_role, allowed_menus)
- The admins table is the business-data companion, like customers/employees tables
- When creating an admin: create auth user (via edge function) + insert into admins table
- When editing: update admins table + sync admin_role/allowed_menus to profiles for auth
*/

CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  phone text,
  admin_role text NOT NULL DEFAULT 'manager',
  status text NOT NULL DEFAULT 'active',
  allowed_menus text[] DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_admins" ON admins;
CREATE POLICY "anon_select_admins" ON admins FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_admins" ON admins;
CREATE POLICY "anon_insert_admins" ON admins FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_admins" ON admins;
CREATE POLICY "anon_update_admins" ON admins FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_admins" ON admins;
CREATE POLICY "anon_delete_admins" ON admins FOR DELETE
  TO anon, authenticated USING (true);

-- Migrate existing admin profiles into the new table
INSERT INTO admins (name, email, admin_role, status, allowed_menus)
SELECT
  COALESCE(full_name, email, 'Admin'),
  email,
  COALESCE(admin_role, 'manager'),
  'active',
  allowed_menus
FROM profiles
WHERE role = 'admin'
ON CONFLICT (email) DO NOTHING;