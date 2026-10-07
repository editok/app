/*
# Add FCM token support for Android push notifications

1. Modified Tables
- `device_tokens`
  - New column `fcm_token` (text, nullable) — the Firebase Cloud Messaging
    registration token returned by the Android app. Populated only for native
    Android devices; web (VAPID) subscriptions keep this null and use the
    existing endpoint/p256dh/auth columns.
  - The existing `endpoint` unique constraint now also covers FCM tokens,
    which are stored as `fcm://<token>` in the endpoint column so the
    one-row-per-subscription invariant still holds.

2. Security
- No policy changes. The existing owner-scoped RLS policies on device_tokens
  continue to apply: each authenticated user can only read/insert/update/delete
  their own rows.

3. Notes
- Web push (VAPID) devices continue to store the browser PushSubscription
  endpoint URL in `endpoint` and leave `fcm_token` null.
- Android (FCM) devices store `fcm://<token>` in `endpoint` and the raw FCM
  token in `fcm_token`.
- The send-push-notification edge function reads `fcm_token` and, when present,
  sends via the FCM HTTP v1 API instead of web-push.
*/

ALTER TABLE device_tokens
  ADD COLUMN IF NOT EXISTS fcm_token text;
