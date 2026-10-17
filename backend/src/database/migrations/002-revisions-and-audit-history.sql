PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS experiment_revisions (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  previous_value_json TEXT NOT NULL,
  proposed_value_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'applied', 'rejected')),
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('assistant', 'user')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revisions_experiment_created
  ON experiment_revisions(experiment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revisions_status
  ON experiment_revisions(status);

CREATE TABLE IF NOT EXISTS research_decisions (
  id TEXT PRIMARY KEY,
  experiment_id TEXT,
  state TEXT NOT NULL CHECK (
    state IN ('proposed', 'confirmed', 'rejected', 'abandoned', 'superseded')
  ),
  statement TEXT NOT NULL,
  owner TEXT,
  source_conversation_id TEXT,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decisions_experiment_created
  ON research_decisions(experiment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_runs (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  revision_id TEXT,
  audit_version TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  FOREIGN KEY (revision_id) REFERENCES experiment_revisions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_experiment_completed
  ON audit_runs(experiment_id, completed_at DESC);

ALTER TABLE audit_findings ADD COLUMN audit_run_id TEXT
  REFERENCES audit_runs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_findings_audit_run
  ON audit_findings(audit_run_id);
