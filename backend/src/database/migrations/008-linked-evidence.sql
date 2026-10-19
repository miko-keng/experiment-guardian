CREATE TABLE IF NOT EXISTS linked_evidence_snapshots (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  gitlab_mr_url TEXT NOT NULL,
  gitlab_project_path TEXT NOT NULL,
  gitlab_mr_iid INTEGER NOT NULL,
  gitlab_commit_sha TEXT NOT NULL,
  mlflow_run_id TEXT NOT NULL,
  mlflow_tracking_url TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_linked_evidence_experiment
  ON linked_evidence_snapshots(experiment_id, fetched_at DESC);
