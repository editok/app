/*
# Add durable notification archive state

1. Purpose
- Keeps cleared notifications hidden after reload instead of showing them again.
- Preserves old notifications so users can open them from the history view.

2. Modified tables
- `notifications.archived_at`: nullable timestamp marking when a notification was cleared.

3. Security
- No new table or policy is introduced.
- Existing notification policies continue to control access.

4. Notes
- Existing notifications remain active because the new column defaults to NULL.
- This change is additive and does not delete user data.
*/

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS notifications_archived_at_idx
  ON public.notifications (archived_at);
