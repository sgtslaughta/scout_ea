-- Feature migration 002: critical deadlines, trends, trend findings.
CREATE TABLE IF NOT EXISTS critical_deadlines (
    id           INTEGER PRIMARY KEY,
    title        TEXT NOT NULL,
    detail       TEXT,
    due_at       TEXT NOT NULL,
    source       TEXT NOT NULL,
    source_skill TEXT,
    external_ref TEXT UNIQUE,
    person_id    INTEGER REFERENCES people(id),
    signal_id    INTEGER REFERENCES signals(id),
    priority     INTEGER NOT NULL DEFAULT 2,
    visible      INTEGER NOT NULL DEFAULT 1,
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deadlines_due ON critical_deadlines(status, visible, due_at);

CREATE TABLE IF NOT EXISTS trends (
    id           INTEGER PRIMARY KEY,
    term         TEXT NOT NULL,
    kind         TEXT NOT NULL,
    score        REAL NOT NULL DEFAULT 0,
    count        INTEGER NOT NULL DEFAULT 0,
    delta        TEXT,
    sources      TEXT,
    window_start TEXT NOT NULL,
    window_end   TEXT NOT NULL,
    first_seen   TEXT,
    last_seen    TEXT,
    source_skill TEXT,
    embedding    BLOB,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(term, window_start)
);
CREATE INDEX IF NOT EXISTS idx_trends_rank ON trends(window_start, score);

CREATE TABLE IF NOT EXISTS trend_findings (
    id           INTEGER PRIMARY KEY,
    trend_id     INTEGER REFERENCES trends(id),
    topic_id     INTEGER REFERENCES topics(id),
    title        TEXT NOT NULL,
    synopsis     TEXT,
    url          TEXT,
    source       TEXT,
    source_skill TEXT,
    external_ref TEXT UNIQUE,
    relevance    INTEGER,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS trg_deadlines_touch AFTER UPDATE ON critical_deadlines
BEGIN UPDATE critical_deadlines SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_trends_touch AFTER UPDATE ON trends
BEGIN UPDATE trends SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO config(key, value) VALUES
  ('deadlines_visible_global', '1'),
  ('outlook_send_time',        '07:00'),
  ('trend_window_days',        '7'),
  ('embed_model',              'all-MiniLM-L6-v2');

-- Feature migration 003: full-text search index (rebuilt on demand by lib.search)
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(kind, ref_id UNINDEXED, title, body);
