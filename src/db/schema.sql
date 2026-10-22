CREATE TABLE IF NOT EXISTS watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  url TEXT NOT NULL,
  care TEXT NOT NULL,
  selector TEXT,
  recipe_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_ms INTEGER,
  status TEXT NOT NULL,
  changed INTEGER NOT NULL DEFAULT 0,
  model_called INTEGER NOT NULL DEFAULT 0,
  matters INTEGER,
  summary TEXT,
  reason TEXT,
  error TEXT,
  browser_ms INTEGER DEFAULT 0,
  model_ms INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  replayed INTEGER NOT NULL DEFAULT 0,
  recipe_fallback INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  run_id INTEGER REFERENCES runs(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_watch_id ON snapshots(watch_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON snapshots(hash);
CREATE INDEX IF NOT EXISTS idx_runs_watch_id ON runs(watch_id);
