CREATE TABLE experiment_sources_v2 (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'manual',
      'bee',
      'conversation',
      'meeting_notes',
      'browser_voice',
      'audio_transcript',
      'demo'
    )
  ),
  source_id TEXT,
  source_reference TEXT,
  transcript_text TEXT,
  transcript_hash TEXT,
  source_timestamp TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id)
    REFERENCES experiments(id)
    ON DELETE CASCADE
);

INSERT INTO experiment_sources_v2 (
  id,
  experiment_id,
  source_type,
  source_id,
  source_reference,
  transcript_text,
  transcript_hash,
  source_timestamp,
  created_at
)
SELECT
  id,
  experiment_id,
  source_type,
  source_id,
  source_reference,
  transcript_text,
  transcript_hash,
  source_timestamp,
  created_at
FROM experiment_sources;

DROP TABLE experiment_sources;
ALTER TABLE experiment_sources_v2 RENAME TO experiment_sources;
