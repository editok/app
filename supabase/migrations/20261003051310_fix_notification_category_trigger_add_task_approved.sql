/*
# Fix notification category trigger: add task-approved

## What changed
The `set_notification_category()` trigger function maps notification `type` to a `category` on insert.
The `task-approved` type was missing from the `task` category mapping, causing those rows to fall
through to the `ELSE 'project'` branch. This is a latent data bug — the frontend filters by `type`
(not by the stored `category` column), so tabs display correctly today, but any code that reads
the stored `category` for analytics, grouping, or filtering would misclassify `task-approved`
notifications as `project`.

## Fix
- Recreate `set_notification_category()` with `task-approved` added to the `task` category list.
- Drop and recreate the trigger (idempotent).
- Also backfill any existing `task-approved` rows that have `category = 'project'` to `category = 'task'`.

## Security
- No RLS changes. The function is SECURITY DEFINER with `search_path = 'public'`, same as before.
*/

CREATE OR REPLACE FUNCTION public.set_notification_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.category IS NULL THEN
    NEW.category := CASE
      WHEN NEW.type IN ('project', 'new-order', 'approval', 'project-completed') THEN 'project'
      WHEN NEW.type IN ('task-approved', 'task-complete', 'task-assigned', 'task-available', 'file-available') THEN 'task'
      WHEN NEW.type IN ('correction', 'review-ready', 'review-approved', 'review-feedback', 'rating') THEN 'review'
      WHEN NEW.type IN ('payment', 'invoice', 'invoice-generated', 'payment-received') THEN 'payment'
      WHEN NEW.type IN ('message') THEN 'chat'
      WHEN NEW.type IN ('deadline', 'system-error') THEN 'reminder'
      ELSE 'project'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_set_category ON notifications;
CREATE TRIGGER notifications_set_category
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_notification_category();

UPDATE notifications SET category = 'task' WHERE type = 'task-approved' AND category = 'project';