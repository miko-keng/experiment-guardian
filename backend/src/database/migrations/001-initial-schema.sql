PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  hypothesis TEXT,
  objective TEXT,
  status TEXT NOT NULL CHECK (
    status IN (
      'draft',
      'auditing',
      'audited',
      'needs_review',
      'failed'
    )
  ),
  model_config_json TEXT NOT NULL,
  dataset_config_json TEXT NOT NULL,
  training_config_json TEXT NOT NULL,
  evaluation_config_json TEXT NOT NULL,
  baseline_experiment_id TEXT,
  extracted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (baseline_experiment_id)
    REFERENCES experiments(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_experiments_created_at
  ON experiments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_experiments_status
  ON experiments(status);

CREATE INDEX IF NOT EXISTS idx_experiments_baseline
  ON experiments(baseline_experiment_id);

CREATE TABLE IF NOT EXISTS experiment_sources (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('manual', 'bee')
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

CREATE TABLE IF NOT EXISTS audit_findings (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (
    severity IN ('info', 'warning', 'critical')
  ),
  status TEXT NOT NULL CHECK (
    status IN (
      'open',
      'resolved',
      'accepted',
      'dismissed'
    )
  ),
  evidence_json TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  resolution_note TEXT,
  audit_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id)
    REFERENCES experiments(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_findings_experiment
  ON audit_findings(experiment_id);

CREATE INDEX IF NOT EXISTS idx_findings_status
  ON audit_findings(status);

CREATE INDEX IF NOT EXISTS idx_findings_rule
  ON audit_findings(rule_id);
