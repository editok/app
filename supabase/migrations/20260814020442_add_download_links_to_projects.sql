/*
# Add download_links column to projects

1. New Columns
- `projects.download_links` (text, nullable) — JSON array of {url, description} links
  that the admin provides for editors to download source files when approving the project.

2. Notes
- This mirrors the existing `tasks.download_links` column but at the project level.
- The first-stage task will inherit this value from the project at creation time.
- No security changes needed; existing RLS policies on projects remain unchanged.
*/

ALTER TABLE projects ADD COLUMN IF NOT EXISTS download_links text;
