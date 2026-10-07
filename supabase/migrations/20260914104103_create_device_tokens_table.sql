/*
# Create device_tokens table for push notifications

1. New Tables
- `device_tokens`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, not null) — the user who owns this device
  - `endpoint` (text, not null) — the push subscription endpoint URL
  - `p256dh_key` (text) — the P-256 public key from the push subscription
  - `auth_key` (text) — the auth secret from the push subscription
  - `platform` (text) — 'mobile-web', 'desktop-web', 'android', 'ios'
  - `active` (boolean, default true) — whether this token is currently receiving notifications
  - `last_seen_at` (timestamptz) — when the device was last online
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `device_tokens`.
- Users can only read/insert/update/delete their own device tokens.
- A unique constraint on `endpoint` ensures one row per push subscription endpoint.

3. Notes
- This table stores push notification subscription data for Customer and Admin roles only.
- Editor is web-only and does not use push notifications.
- Each user can have multiple device tokens (multiple devices).
- When a device unregisters, we set `active = false` rather than deleting the row.
*/

CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh_key text,
  auth_key text,
  platform text DEFAULT 'mobile-web',
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_endpoint_unique ON device_tokens(endpoint);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tokens" ON device_tokens;
CREATE POLICY "select_own_tokens" ON device_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tokens" ON device_tokens;
CREATE POLICY "insert_own_tokens" ON device_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tokens" ON device_tokens;
CREATE POLICY "update_own_tokens" ON device_tokens FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tokens" ON device_tokens;
CREATE POLICY "delete_own_tokens" ON device_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);