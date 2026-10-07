-- Add function to check if current user is a Main Admin
CREATE OR REPLACE FUNCTION public.is_current_user_main_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role = 'admin'
  AND admin_role = 'main'
);
$$;

-- Add trigger to prevent non-main admins from changing admin_role on profiles
-- This blocks privilege escalation: a manager cannot set admin_role='main'
CREATE OR REPLACE FUNCTION public.guard_admin_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only enforce on rows where admin_role is being set/changed
  IF NEW.admin_role IS DISTINCT FROM OLD.admin_role THEN
    IF NOT public.is_current_user_main_admin() THEN
      RAISE EXCEPTION 'Only Main Admins can change admin_role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_admin_role ON profiles;
CREATE TRIGGER profiles_guard_admin_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_admin_role_changes();
