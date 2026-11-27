-- Run on an existing database before deploying the upload deduplication code.
BEGIN;

ALTER TABLE forms
    ADD COLUMN IF NOT EXISTS source_sha256 TEXT,
    ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES forms(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_unique_upload
    ON forms (uploaded_by, source_sha256)
    WHERE duplicate_of IS NULL AND source_sha256 IS NOT NULL;

COMMIT;
