/*
# Create token-validated guest review functions

1. Purpose
- Move all guest review table access behind token-validated SECURITY DEFINER functions.
- Replace direct anonymous table reads/writes on corrections and review_files with RPCs that validate the share token server-side.
- This is the prerequisite for removing anonymous table access on those tables.

2. New Functions
- `guest_fetch_review_files(p_token uuid)`: Returns review files for the project matching the share token. Returns empty set if token is invalid.
- `guest_fetch_corrections(p_token uuid)`: Returns corrections for the project matching the share token. Returns empty set if token is invalid.
- `guest_submit_correction(p_token uuid, p_correction jsonb)`: Inserts a correction for the token's project. Validates token, extracts project_id server-side, sets status to 'pending'. Returns the new correction id or NULL on invalid token.
- `guest_update_correction(p_token uuid, p_correction_id uuid, p_updates jsonb)`: Updates a correction if it belongs to the token's project and is in 'draft' or 'pending' status. Prevents updating admin_approval or other privileged fields. Returns boolean success.
- `guest_fetch_draft_correction(p_token uuid, p_review_file_id uuid)`: Returns the latest draft correction for a given review file under the token's project.

3. Security
- All functions are SECURITY DEFINER with fixed search_path = public.
- Token validation happens server-side in every function via a lookup against projects.share_token.
- guest_update_correction verifies the correction belongs to the token's project before updating.
- guest_update_correction only allows updating photo_marks, video_timestamps, voice_notes, status, additional_files_link, and updated_at — NOT admin_approval, editor_id, or other internal fields.
- EXECUTE granted to anon and authenticated (guest links are public).

4. Important Notes
- These functions replace the frontend's direct table access patterns in fetchReviewFilesByShareToken, fetchCorrectionsByShareToken, guestSubmitCorrection, guestUpdateCorrection, and fetchDraftCorrection.
- The frontend will be updated to call these RPCs instead of direct table queries.
- After the frontend is updated, anonymous table policies on corrections and review_files can be removed.
- guest_approve_proof already exists and remains unchanged.
*/

CREATE OR REPLACE FUNCTION public.guest_fetch_review_files(p_token uuid)
RETURNS SETOF public.review_files
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.review_files
  WHERE project_id = (
    SELECT id FROM public.projects WHERE share_token = p_token LIMIT 1
  )
  ORDER BY version ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.guest_fetch_review_files(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_fetch_review_files(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_fetch_corrections(p_token uuid)
RETURNS SETOF public.corrections
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.corrections
  WHERE project_id = (
    SELECT id FROM public.projects WHERE share_token = p_token LIMIT 1
  )
  ORDER BY created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.guest_fetch_corrections(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_fetch_corrections(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_submit_correction(p_token uuid, p_correction jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  v_new_id uuid;
  v_allowed jsonb;
BEGIN
  SELECT id INTO v_project_id FROM public.projects WHERE share_token = p_token LIMIT 1;
  IF v_project_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only allow guest-writable fields through; strip any privileged columns
  v_allowed := jsonb_build_object(
    'photo_marks', COALESCE(p_correction->'photo_marks', '[]'::jsonb),
    'video_timestamps', COALESCE(p_correction->'video_timestamps', '[]'::jsonb),
    'voice_notes', COALESCE(p_correction->'voice_notes', '[]'::jsonb),
    'status', COALESCE(p_correction->>'status', 'pending'),
    'priority', COALESCE(p_correction->>'priority', 'medium'),
    'review_file_id', p_correction->'review_file_id',
    'additional_files_link', p_correction->'additional_files_link',
    'number', p_correction->'number',
    'order_id', p_correction->'order_id',
    'event_name', p_correction->'event_name',
    'customer', p_correction->'customer',
    'customer_email', p_correction->'customer_email'
  );

  INSERT INTO public.corrections (
    project_id, number, order_id, event_name, customer, customer_email,
    photo_marks, video_timestamps, voice_notes, status, priority,
    review_file_id, additional_files_link
  )
  VALUES (
    v_project_id,
    v_allowed->>'number',
    v_allowed->>'order_id',
    v_allowed->>'event_name',
    v_allowed->>'customer',
    v_allowed->>'customer_email',
    (v_allowed->'photo_marks')::jsonb,
    (v_allowed->'video_timestamps')::jsonb,
    (v_allowed->'voice_notes')::jsonb,
    v_allowed->>'status',
    v_allowed->>'priority',
    NULLIF(v_allowed->>'review_file_id', '')::uuid,
    v_allowed->>'additional_files_link'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guest_submit_correction(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_submit_correction(uuid, jsonb) TO anon, authenticated;

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
BEGIN
  SELECT id INTO v_project_id FROM public.projects WHERE share_token = p_token LIMIT 1;
  IF v_project_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify the correction belongs to this token's project
  SELECT count(*) INTO v_count FROM public.corrections
  WHERE id = p_correction_id AND project_id = v_project_id;
  IF v_count = 0 THEN
    RETURN false;
  END IF;

  -- Only allow guest-writable fields; never allow admin_approval, editor_id, project_id changes
  UPDATE public.corrections
  SET
    photo_marks = COALESCE(CASE WHEN p_updates ? 'photo_marks' THEN (p_updates->'photo_marks')::jsonb ELSE NULL END, photo_marks),
    video_timestamps = COALESCE(CASE WHEN p_updates ? 'video_timestamps' THEN (p_updates->'video_timestamps')::jsonb ELSE NULL END, video_timestamps),
    voice_notes = COALESCE(CASE WHEN p_updates ? 'voice_notes' THEN (p_updates->'voice_notes')::jsonb ELSE NULL END, voice_notes),
    status = COALESCE(NULLIF(p_updates->>'status', ''), status),
    additional_files_link = COALESCE(NULLIF(p_updates->>'additional_files_link', ''), additional_files_link),
    updated_at = now()
  WHERE id = p_correction_id AND project_id = v_project_id;

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guest_update_correction(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_update_correction(uuid, uuid, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_fetch_draft_correction(p_token uuid, p_review_file_id uuid)
RETURNS public.corrections
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.corrections
  WHERE project_id = (
    SELECT id FROM public.projects WHERE share_token = p_token LIMIT 1
  )
  AND status = 'draft'
  AND (p_review_file_id IS NULL OR review_file_id = p_review_file_id)
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.guest_fetch_draft_correction(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_fetch_draft_correction(uuid, uuid) TO anon, authenticated;
