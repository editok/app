-- Fix: profiles RLS policies had infinite recursion.
-- The admin SELECT/UPDATE policies ran a subquery against `profiles`
-- to check role='admin', but that subquery is itself subject to RLS,
-- which re-evaluates the same policy → stack-depth error on every
-- profile read. The frontend then falls back to role='customer' for
-- ALL users, which is why everyone sees the customer dashboard.
--
-- Solution: a SECURITY DEFINER function that reads the role without
-- RLS, used by the policies instead of a recursive subquery.

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Replace the recursive SELECT policy
DROP POLICY IF EXISTS "profiles_select_admin_all" ON profiles;
CREATE POLICY "profiles_select_admin_all" ON profiles FOR SELECT
  TO authenticated USING (public.is_current_user_admin());

-- Replace the recursive UPDATE policy
DROP POLICY IF EXISTS "profiles_update_admin_all" ON profiles;
CREATE POLICY "profiles_update_admin_all" ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Grant execute to authenticated only (not anon)
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
