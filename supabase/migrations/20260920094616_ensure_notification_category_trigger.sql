-- Ensure the notification category trigger exists and matches the frontend CATEGORY_MAP
-- This is idempotent: drops and recreates the function + trigger

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
      WHEN NEW.type IN ('task-complete', 'task-assigned', 'task-available', 'file-available') THEN 'task'
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
