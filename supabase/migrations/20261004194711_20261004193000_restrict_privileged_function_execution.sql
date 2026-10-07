/*
# Complete privileged function execution hardening

1. Purpose
- Remove PostgreSQL's default PUBLIC EXECUTE grant from privileged application functions.
- Keep signed-in application workflows working through explicit authenticated grants.

2. Security changes
- Revoke EXECUTE from PUBLIC, which also removes inherited anonymous execution.
- Grant EXECUTE only to authenticated for privileged workflow functions.
- Keep the token-gated guest-review functions unchanged.

3. Important notes
- This is an idempotent correction to the function-permission hardening migration.
- Guest review remains available through its existing token-validated functions.
*/

REVOKE EXECUTE ON FUNCTION public.emit_notification(text, text, text, text, text, text, text, uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_notification(text, text, text, text, text, text, text, uuid, jsonb, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fetch_project_messages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_project_messages(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;
ALTER FUNCTION public.generate_invoice_number() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_project_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_role(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.guard_admin_role_changes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_admin_role_changes() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_current_user_main_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_main_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.recompute_project_progress() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_project_progress() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_notification_category() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_notification_category() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transition_invoice_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_invoice_status(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transition_project_payment_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_project_payment_status(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transition_project_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_project_status(uuid, text) TO authenticated;
