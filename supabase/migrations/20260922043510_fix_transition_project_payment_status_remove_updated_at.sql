/*
# Fix transition_project_payment_status function

## Problem
The `transition_project_payment_status` function references `updated_at` in its
UPDATE statements, but the `project_payments` table has no `updated_at` column.
This caused every call to the function — i.e. the "Verify" and "Reject" buttons
on the Finance page — to fail with:
  `column "updated_at" of relation "project_payments" does not exist`

## Fix
Recreate the function without the `updated_at` assignments. The table tracks
`verified_at` / `verified_by` for verified payments and `rejection_reason` for
rejected payments, which is sufficient.

## Security
The function remains SECURITY DEFINER with search_path = public, and retains
its existing EXECUTE grants for anon, authenticated, and service_role.
*/

DROP FUNCTION IF EXISTS public.transition_project_payment_status(uuid, text, text);

CREATE FUNCTION public.transition_project_payment_status(
  p_payment_id uuid,
  p_new_status text,
  p_actor text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status text;
  v_allowed text[];
  v_transition text;
BEGIN
  SELECT status INTO v_old_status FROM public.project_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_old_status = p_new_status THEN RETURN p_new_status; END IF;

  v_allowed := ARRAY[
    'pending_verification->verified',
    'pending_verification->rejected'
  ];

  v_transition := v_old_status || '->' || p_new_status;
  IF NOT (v_transition = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Invalid payment status transition: % -> %', v_old_status, p_new_status;
  END IF;

  IF p_new_status = 'verified' THEN
    UPDATE public.project_payments
    SET status = 'verified',
        verified_at = now(),
        verified_by = COALESCE(p_actor, verified_by)
    WHERE id = p_payment_id;
  ELSIF p_new_status = 'rejected' THEN
    UPDATE public.project_payments
    SET status = 'rejected'
    WHERE id = p_payment_id;
  ELSE
    UPDATE public.project_payments
    SET status = p_new_status
    WHERE id = p_payment_id;
  END IF;

  RETURN p_new_status;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transition_project_payment_status(uuid, text, text) TO anon, authenticated, service_role;
