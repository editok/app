-- Add allowed_menus column to profiles for per-admin sidebar menu access control
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_menus text[];

-- Main admins get NULL (meaning: all menus allowed). Other admin roles get NULL by default too,
-- but admins can be restricted by setting allowed_menus to a specific list of menu keys.
-- When allowed_menus IS NULL, all menus are shown. When it's an array, only those keys are shown.
