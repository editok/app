/*
# Create profiles table for unified auth

## Purpose
Stores per-user metadata (role, full name, avatar) linked 1:1 to auth.users.
This is the single source of truth for role-based routing after login.

## New Tables
- `profiles`
  - `id` (uuid, PK, matches auth.users.id)
  - `email` (text, user email copied from auth)
  - `full_name` (text, display name)
  - `avatar_url` (text, nullable, Google OAuth avatar)
  - `role` (text, NOT NULL, default 'customer' — one of: admin, editor, customer)
  - `provider` (text, nullable — 'google' or 'email')
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

## Security
- RLS enabled.
- Users can read their own profile (SELECT, auth.uid() = id).
- Users can update their own profile (UPDATE, auth.uid() = id).
- INSERT is allowed for authenticated users on their own row (auth.uid() = id)
  so the frontend can upsert a profile after Google OAuth first login.
- No DELETE policy (profiles should not be deleted via the anon client).
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'customer',
  provider text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
