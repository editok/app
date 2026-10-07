-- Auto-categorize notifications on insert based on the type column
-- Mirrors the frontend CATEGORY_MAP logic exactly

CREATE OR REPLACE FUNCTION public.set_notification_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.category IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.category := CASE
    -- project
    WHEN NEW.type IN ('project', 'new-order', 'approval', 'project-completed') THEN 'project'
    -- task
    WHEN NEW.type IN ('task-complete', 'task-assigned', 'task-available', 'file-available') THEN 'task'
    -- review
    WHEN NEW.type IN ('correction', 'review-ready', 'review-approved', 'review-feedback', 'rating') THEN 'review'
    -- payment
    WHEN NEW.type IN ('payment', 'invoice', 'invoice-generated', 'payment-received') THEN 'payment'
    -- chat
    WHEN NEW.type IN ('message') THEN 'chat'
    -- reminder
    WHEN NEW.type IN ('deadline', 'system-error') THEN 'reminder'
    -- fallback
    ELSE 'project'
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_set_category ON notifications;
CREATE TRIGGER notifications_set_category
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_notification_category();
