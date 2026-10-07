/*
# Add language column to profiles + avatars storage bucket

## What this does
1. Adds a `language` column to the `profiles` table so users can store their preferred Indian regional language. Defaults to 'English'.
2. Creates a public `avatars` storage bucket for profile picture uploads.
3. Adds storage policies allowing authenticated users to upload/read their own avatar (path = their user id) and anyone to read avatars (public bucket).

## New columns
- profiles.language (text, default 'English') — preferred UI language for the user.

## Storage
- Bucket `avatars` (public = true).
- Policies:
  - SELECT (read): public — anyone can read avatar images.
  - INSERT/UPDATE: authenticated users can write only to an object path equal to their own user id (e.g. `avatars/<user_id>/photo.png`).
  - DELETE: same ownership rule.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'English';

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatar_read_public" ON storage.objects;
CREATE POLICY "avatar_read_public"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_insert_own" ON storage.objects;
CREATE POLICY "avatar_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_update_own" ON storage.objects;
CREATE POLICY "avatar_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_delete_own" ON storage.objects;
CREATE POLICY "avatar_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
