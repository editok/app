/*
# Restrict privileged database functions to signed-in users

1. Purpose
- Prevent anonymous callers from invoking notification, workflow-transition, admin-check, message, and invoice helper functions through the public Data API.
- Preserve the public guest-review workflow by leaving only its explicitly token-gated functions callable anonymously.

2. Functions changed
- `emit_notification`: application notification creation and push dispatch.
- `fetch_project_messages`: authenticated project chat retrieval.
- `generate_invoice_number`: authenticated invoice creation helper.
- `get_project_role`: signed-in project authorization helper.
- `guard_admin_role_changes`: trigger/helper for protected administrator changes.
- `is_current_user_main_admin`: signed-in administrator check.
- `recompute_project_progress`: internal project progress maintenance.
- `set_notification_category`: internal notification maintenance.
- `transition_invoice_status`: authenticated invoice workflow transition.
- `transition_project_payment_status`: authenticated payment workflow transition.
- `transition_project_status`: authenticated project workflow transition.

3. Security changes
- Revoke EXECUTE from `anon` on the privileged functions above.
- Grant EXECUTE to `authenticated` so existing signed-in application workflows continue to work.
- Set a fixed `search_path` on `generate_invoice_number` to remove search-path hijacking risk.

4. Important notes
- The token-gated guest-review functions `get_project_by_share_token`, `guest_approve_proof`, and `submit_project_ratings` are intentionally not changed because the public review link depends on them.
- Anonymous direct table policies for guest corrections and review files require a follow-up migration that moves those operations behind token-validated functions before their anonymous table access can be removed safely.
*/

REVOKE EXECUTE ON FUNCTION public.emit_notification(text, text, text, text, text, text, text, uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.emit_notification(text, text, text, text, text, text, text, uuid, jsonb, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fetch_project_messages(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fetch_project_messages(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;
ALTER FUNCTION public.generate_invoice_number() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_project_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_project_role(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.guard_admin_role_changes() FROM anon;
GRANT EXECUTE ON FUNCTION public.guard_admin_role_changes() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_current_user_main_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_main_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.recompute_project_progress() FROM anon;
GRANT EXECUTE ON FUNCTION public.recompute_project_progress() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_notification_category() FROM anon;
GRANT EXECUTE ON FUNCTION public.set_notification_category() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transition_invoice_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_invoice_status(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transition_project_payment_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_project_payment_status(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transition_project_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_project_status(uuid, text) TO authenticated;
