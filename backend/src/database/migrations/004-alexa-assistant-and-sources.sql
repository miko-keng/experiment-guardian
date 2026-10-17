CREATE TABLE IF NOT EXISTS source_artifacts (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  original_name TEXT,
  media_type TEXT,
  content_hash TEXT NOT NULL,
  extracted_text TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assistant_sessions (
  id TEXT PRIMARY KEY,
  experiment_id TEXT,
  source_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  unresolved_finding_id TEXT,
  pending_approval_id TEXT,
  last_tool_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE SET NULL,
  FOREIGN KEY (source_id) REFERENCES source_artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  client_message_id TEXT,
  model_id TEXT,
  linked_experiment_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_experiment_id) REFERENCES experiments(id) ON DELETE SET NULL,
  UNIQUE(session_id, client_message_id)
);

CREATE TABLE IF NOT EXISTS session_observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  client_observation_id TEXT NOT NULL,
  text TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id, client_observation_id)
);

CREATE TABLE IF NOT EXISTS tool_invocations (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  message_id TEXT,
  tool_name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES assistant_messages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  revision_ids_json TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  FOREIGN KEY (session_id) REFERENCES assistant_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES assistant_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS experiment_reports (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  audit_run_id TEXT,
  format TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assistant_sessions_updated ON assistant_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON assistant_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invocations_session ON tool_invocations(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_session_sequence ON session_events(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_sources_hash ON source_artifacts(content_hash);
