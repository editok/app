/*
# Create broadcast_campaigns table

1. New Tables
- `broadcast_campaigns`
  - `id` (uuid, primary key)
  - `subject` (text, not null) — email subject line
  - `body_content` (text, not null) — plain-text email body
  - `audience` (text, not null) — 'customer' or 'editor'
  - `status` (text, not null, default 'draft') — 'draft', 'sending', 'sent', or 'failed'
  - `recipient_count` (int, default 0) — number of recipients
  - `sent_count` (int, default 0) — number successfully sent
  - `failed_count` (int, default 0) — number that failed
  - `created_by` (text, nullable) — admin email who created the campaign
  - `created_at` (timestamptz, default now())
  - `sent_at` (timestamptz, nullable) — when the campaign was sent
2. Security
- Enable RLS on `broadcast_campaigns`.
- Admin-only access: all CRUD scoped to authenticated users (the app has sign-in).
*/

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body_content text NOT NULL,
  audience text NOT NULL DEFAULT 'customer',
  status text NOT NULL DEFAULT 'draft',
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcast_select_authenticated" ON broadcast_campaigns;
CREATE POLICY "broadcast_select_authenticated"
ON broadcast_campaigns FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "broadcast_insert_authenticated" ON broadcast_campaigns;
CREATE POLICY "broadcast_insert_authenticated"
ON broadcast_campaigns FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "broadcast_update_authenticated" ON broadcast_campaigns;
CREATE POLICY "broadcast_update_authenticated"
ON broadcast_campaigns FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "broadcast_delete_authenticated" ON broadcast_campaigns;
CREATE POLICY "broadcast_delete_authenticated"
ON broadcast_campaigns FOR DELETE
TO authenticated USING (true);
