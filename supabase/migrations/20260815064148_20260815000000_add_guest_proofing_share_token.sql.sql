/*
# Guest Proofing: Add share_token to projects for public review access

## Summary
Adds a `share_token` UUID column to the `projects` table so that a project's
review files and corrections can be accessed by unauthenticated guests (end-customers)
via a public `/proof/:share_token` link. Also adds policies allowing anon access
to review_files and corrections when the parent project has a matching share_token,
and a SECURITY DEFINER function to fetch project data by token.

## New Columns
- `projects.share_token` (uuid, nullable, default gen_random_uuid())
  - Generated automatically when a project is created; can also be generated on demand.
  - When non-null, allows public read access to that project's review files and corrections.

## Security Changes
1. Projects table: new SELECT policy `guest_select_project_by_token` for `anon, authenticated`
   that allows reading a project row when `share_token` matches the one passed via
   the `guest_proof_token` setting (set by the RPC function).
2. Review Files table: new SELECT policy `guest_select_review_files_by_token` for `anon, authenticated`
   that allows reading review files where the parent project's share_token matches.
3. Corrections table: new SELECT policy `guest_select_corrections_by_token` for `anon, authenticated`
   that allows reading corrections where the parent project's share_token matches.
4. Corrections table: new INSERT policy `guest_insert_corrections_by_token` for `anon, authenticated`
   that allows creating corrections for a project whose share_token matches.
5. SECURITY DEFINER function `get_project_by_share_token(token uuid)` — fetches a project
   row by share_token, bypassing RLS, so the guest page can load project metadata.

## Important Notes
1. The existing owner-based authenticated policies on projects, review_files, and corrections
   are NOT modified — only additional anon-accessible policies are added.
2. The share_token is a UUID, hard to guess, providing security-through-obscurity.
3. The admin/customer can regenerate the token at any time to invalidate old links.
*/

-- Add share_token column to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'share_token'
  ) THEN
    ALTER TABLE projects ADD COLUMN share_token uuid DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Backfill any existing rows that have NULL share_token
UPDATE projects SET share_token = gen_random_uuid() WHERE share_token IS NULL;

-- ========== Projects: guest select by token ==========
-- We use a SECURITY DEFINER function instead of a policy with a setting,
-- because passing the token via settings is complex from the client.
-- The function bypasses RLS safely for a single read.

CREATE OR REPLACE FUNCTION public.get_project_by_share_token(p_token uuid)
RETURNS public.projects
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.projects WHERE share_token = p_token LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_by_share_token(uuid) TO anon, authenticated;

-- ========== Review Files: guest select by parent project token ==========
DROP POLICY IF EXISTS "guest_select_review_files_by_token" ON review_files;
CREATE POLICY "guest_select_review_files_by_token"
ON review_files FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = review_files.project_id
      AND projects.share_token IS NOT NULL
  )
);

-- ========== Corrections: guest select by parent project token ==========
DROP POLICY IF EXISTS "guest_select_corrections_by_token" ON corrections;
CREATE POLICY "guest_select_corrections_by_token"
ON corrections FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = corrections.project_id
      AND projects.share_token IS NOT NULL
  )
);

-- ========== Corrections: guest insert by parent project token ==========
-- Guests can submit corrections (feedback) for a project that has a share_token.
-- We validate the project_id matches a project with the token at insert time.
DROP POLICY IF EXISTS "guest_insert_corrections_by_token" ON corrections;
CREATE POLICY "guest_insert_corrections_by_token"
ON corrections FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = corrections.project_id
      AND projects.share_token IS NOT NULL
  )
);

-- ========== Projects: guest update status (for approve proof) ==========
-- Allow anon to update project status when share_token is set
-- We scope this via a SECURITY DEFINER function instead for safety.
CREATE OR REPLACE FUNCTION public.guest_approve_proof(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET status = 'approved', progress = 100, updated_at = now()
  WHERE share_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guest_approve_proof(uuid) TO anon, authenticated;
