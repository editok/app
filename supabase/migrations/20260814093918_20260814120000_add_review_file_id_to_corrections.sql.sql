ALTER TABLE corrections
  ADD COLUMN IF NOT EXISTS review_file_id uuid REFERENCES review_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_corrections_review_file ON corrections(review_file_id);
