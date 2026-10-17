PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bee_conversations (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL UNIQUE,
  title TEXT,
  started_at TEXT,
  ended_at TEXT,
  last_synced_at TEXT,
  last_utterance_timestamp INTEGER,
  content_hash TEXT,
  import_status TEXT NOT NULL CHECK (
    import_status IN ('pending', 'syncing', 'ready', 'failed')
  ),
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bee_conversations_started
  ON bee_conversations(started_at DESC);

CREATE TABLE IF NOT EXISTS bee_utterances (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  provider_utterance_id TEXT,
  speaker TEXT,
  spoken_at TEXT,
  spoken_at_epoch_ms INTEGER,
  text TEXT NOT NULL,
  source_offset INTEGER,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES bee_conversations(id) ON DELETE CASCADE,
  UNIQUE (conversation_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_bee_utterances_conversation_time
  ON bee_utterances(conversation_id, spoken_at_epoch_ms, source_offset);
