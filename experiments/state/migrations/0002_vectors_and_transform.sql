-- Reviewed owner-local custom artifact; vec0/shadow tables are not auto-diffed.
CREATE VIRTUAL TABLE fixture_vectors USING vec0(embedding float[3]);
UPDATE fixture_notes SET tag = 'migrated:' || text;
