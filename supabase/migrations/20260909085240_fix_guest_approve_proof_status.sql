/*
# Fix guest_approve_proof to set review_approved instead of approved

## Problem
The guest_approve_proof function sets project status to 'approved' when a customer
approves a proof via the shared guest link. This collides with the admin workflow
where 'approved' means a newly created order has been approved for editor assignment.
A guest approving a proof would cause the project to reappear in Available Works for
editors, restarting the workflow.

## Fix
Change the function to set status to 'review_approved' and progress to 100, which is
the correct status for "customer has approved the review proof" — the admin can then
create an invoice and close the project.

## Changes
- Modified: public.guest_approve_proof function — SET status = 'review_approved'
- No table structure changes
- No RLS changes
- No data loss (function update only)
*/

CREATE OR REPLACE FUNCTION public.guest_approve_proof(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE projects
  SET status = 'review_approved', progress = 100, updated_at = now()
  WHERE share_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guest_approve_proof(uuid) TO anon, authenticated;
