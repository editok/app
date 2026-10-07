/*
# Fix guest_update_correction to honor priority, due_date, number, review_file_id, and editor fields

1. Purpose
- The existing guest_update_correction only updated photo_marks, video_timestamps,
  voice_notes, status, additional_files_link, and updated_at. When the guest review
  page submits a draft as 'pending', it recomputes priority, due_date, number and
  review_file_id but those values were silently discarded.
- It also failed to set the correct project/order/editor/customer fields when a
  draft created via "save source link" (which had empty editor fields) was later
  promoted to pending.

2. Changes
- guest_update_correction now also updates: number, order_id, event_name, customer,
  customer_email, editor, editor_id, priority, due_date, review_file_id.
- All updated fields are optional via `p_updates ? 'field'` checks, so partial
  updates (e.g. auto-save of marks only) continue to work.
- review_file_id supports NULL (so drafts without a review file can be attached
  to one when submitted).
- No privileged fields (admin_approval, admin_approval_note, admin_approval_at,
  approved_review_file_id, correction_file_*) are ever writable by guests.

3. Security
- SECURITY DEFINER, fixed search_path = public, token-validated, project-owned.
- Only guest-writable business fields are accepted.
- EXECUTE restricted to anon + authenticated (guest links are public).
*/

CREATE OR REPLACE FUNCTION public.guest_update_correction(
  p_token uuid,
  p_correction_id uuid,
  p_updates jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  v_count integer;
  v_project public.projects%ROWTYPE;
  v_employee public.employees%ROWTYPE;
  v_has_employee boolean := false;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE share_token = p_token LIMIT 1;
  IF v_project.id IS NULL THEN
    RETURN false;
  END IF;
  v_project_id := v_project.id;

  -- Verify the correction belongs to this token's project
  SELECT count(*) INTO v_count FROM public.corrections
  WHERE id = p_correction_id AND project_id = v_project_id;
  IF v_count = 0 THEN
    RETURN false;
  END IF;

  -- If editor_id is present on the project, look up the employee for editor name
  IF v_project.editor_id IS NOT NULL THEN
    SELECT * INTO v_employee FROM public.employees WHERE id = v_project.editor_id LIMIT 1;
    v_has_employee := v_employee.id IS NOT NULL;
  END IF;

  UPDATE public.corrections
  SET
    photo_marks = COALESCE(CASE WHEN p_updates ? 'photo_marks' THEN (p_updates->'photo_marks')::jsonb ELSE NULL END, photo_marks),
    video_timestamps = COALESCE(CASE WHEN p_updates ? 'video_timestamps' THEN (p_updates->'video_timestamps')::jsonb ELSE NULL END, video_timestamps),
    voice_notes = COALESCE(CASE WHEN p_updates ? 'voice_notes' THEN (p_updates->'voice_notes')::jsonb ELSE NULL END, voice_notes),
    status = COALESCE(NULLIF(p_updates->>'status', ''), status),
    additional_files_link = COALESCE(NULLIF(p_updates->>'additional_files_link', ''), additional_files_link),
    number = COALESCE(NULLIF(p_updates->>'number', ''), number),
    order_id = COALESCE(NULLIF(p_updates->>'order_id', ''), order_id),
    event_name = COALESCE(NULLIF(p_updates->>'event_name', ''), event_name),
    customer = COALESCE(NULLIF(p_updates->>'customer', ''), customer),
    customer_email = COALESCE(NULLIF(p_updates->>'customer_email', ''), customer_email),
    editor = COALESCE(NULLIF(p_updates->>'editor', ''), editor),
    editor_id = COALESCE(NULLIF(p_updates->>'editor_id', '')::uuid, editor_id),
    priority = COALESCE(NULLIF(p_updates->>'priority', ''), priority),
    due_date = CASE WHEN p_updates ? 'due_date' THEN NULLIF(p_updates->>'due_date', '')::date ELSE due_date END,
    review_file_id = CASE WHEN p_updates ? 'review_file_id' THEN NULLIF(p_updates->>'review_file_id', '')::uuid ELSE review_file_id END,
    updated_at = now()
  WHERE id = p_correction_id AND project_id = v_project_id;

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guest_update_correction(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_update_correction(uuid, uuid, jsonb) TO anon, authenticated;
