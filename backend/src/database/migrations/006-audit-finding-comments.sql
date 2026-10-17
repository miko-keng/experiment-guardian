CREATE TABLE IF NOT EXISTS audit_finding_comments (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (finding_id) REFERENCES audit_findings(id) ON DELETE CASCADE,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES assistant_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_finding_comments_finding
  ON audit_finding_comments(finding_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finding_comments_experiment
  ON audit_finding_comments(experiment_id, created_at DESC);
