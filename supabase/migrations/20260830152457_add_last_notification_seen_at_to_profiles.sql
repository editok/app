/*
# Add last notification seen timestamp to profiles

## Changes
- Adds `last_notification_seen_at` (timestamptz, nullable) to the `profiles` table.
- Used to show "Last notification seen: <time>" in the notification bell dropdown
  and Notifications page, so users can tell when they last checked their notifications.

## Security
- No new tables. No RLS policy changes.
- The column is writable by the owning user via the existing profiles UPDATE policy.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_notification_seen_at timestamptz;
