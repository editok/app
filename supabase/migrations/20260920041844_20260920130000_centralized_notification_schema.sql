/*
# Centralized notification system schema

1. Purpose
- Introduces category, resolved state, event_key deduplication, and metadata columns
- Enables a single centralized emit_notification function for all events

2. Modified tables
- notifications: add category, resolved_at, event_key, metadata columns

3. Security
- No new table or policy is introduced
- Existing notification policies continue to control access

4. Notes
- category replaces the old free-text "type" for grouping (PROJECT/TASK/REVIEW/PAYMENT/CHAT/REMINDER)
- event_key prevents duplicate notifications from page refresh / API retry / duplicate frontend calls
- resolved_at is separate from read — read means "seen by user", resolved means "action taken"
*/

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Unique constraint on event_key to prevent duplicates from retries/refreshes
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key_unique_idx
  ON public.notifications (event_key)
  WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_category_idx
  ON public.notifications (category);

CREATE INDEX IF NOT EXISTS notifications_resolved_idx
  ON public.notifications (resolved_at);
