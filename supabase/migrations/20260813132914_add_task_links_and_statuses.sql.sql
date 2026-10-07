/*
# Add download/upload links and new statuses to tasks

1. New Columns
- `tasks.download_links` (text, nullable) — JSON array of {url, description} links the editor downloads for this stage
- `tasks.upload_links` (text, nullable) — JSON array of {url, description} links the editor uploads completed work to

2. Status Flow Changes
- Tasks no longer auto-advance to 'in-progress' when the previous stage is approved; they stay 'pending' until assigned/picked.
- New statuses 'partial-completed' and 'fully-completed' replace 'in-progress'/'review-pending' when editors upload work files.

3. Security
- No RLS policy changes; existing task policies remain in effect.
*/

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS download_links text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS upload_links text;
