PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS experiment_artifacts (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  uri TEXT,
  content_hash TEXT,
  metadata_json TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_experiment_artifacts_experiment_kind
  ON experiment_artifacts(experiment_id, kind);

CREATE TABLE IF NOT EXISTS experiment_policies (
  experiment_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS experiment_artifact_files (
  artifact_id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  content BLOB NOT NULL,
  FOREIGN KEY (artifact_id) REFERENCES experiment_artifacts(id) ON DELETE CASCADE
);
