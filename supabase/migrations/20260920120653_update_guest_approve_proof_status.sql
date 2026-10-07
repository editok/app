CREATE OR REPLACE FUNCTION public.guest_approve_proof(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.projects
  SET status = 'correction_approved', progress = 100, updated_at = now()
  WHERE share_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guest_approve_proof(uuid) TO anon, authenticated;
