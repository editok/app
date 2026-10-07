/*
# Create storage bucket for review file uploads

1. Storage
- Create a public bucket `review-files` for uploading PDF and video review files (up to 100MB).
- The bucket is public-read so customers and editors can view the files in the browser.
- Uploads are allowed by anon and authenticated roles (the app uses anon-key client).

2. Security
- SELECT (read) policy: public — anyone with the URL can read.
- INSERT (upload) policy: anon + authenticated can upload.
- UPDATE/DELETE: anon + authenticated can modify.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-files', 'review-files', true, 104857600, null)
ON CONFLICT (id) DO NOTHING;

-- SELECT policy (public read)
DROP POLICY IF EXISTS "review_files_public_select" ON storage.objects;
CREATE POLICY "review_files_public_select"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'review-files');

-- INSERT policy (upload)
DROP POLICY IF EXISTS "review_files_anon_insert" ON storage.objects;
CREATE POLICY "review_files_anon_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'review-files');

-- UPDATE policy
DROP POLICY IF EXISTS "review_files_anon_update" ON storage.objects;
CREATE POLICY "review_files_anon_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'review-files')
WITH CHECK (bucket_id = 'review-files');

-- DELETE policy
DROP POLICY IF EXISTS "review_files_anon_delete" ON storage.objects;
CREATE POLICY "review_files_anon_delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'review-files');
