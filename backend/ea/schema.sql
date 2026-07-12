PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. KEY PERSONNEL ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS people (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    role        TEXT,
    org         TEXT,
    importance  INTEGER NOT NULL DEFAULT 3,
    notes       TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. CONTACT HANDLES --------------------------------------------------------
CREATE TABLE IF NOT EXISTS person_handles (
    id         INTEGER PRIMARY KEY,
    person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    channel    TEXT NOT NULL,
    handle     TEXT NOT NULL,
    UNIQUE(channel, handle)
);
CREATE INDEX IF NOT EXISTS idx_handles_lookup ON person_handles(channel, handle);

-- 3. RESEARCH & LEARNING TOPICS ---------------------------------------------
CREATE TABLE IF NOT EXISTS topics (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    description   TEXT,
    priority      INTEGER NOT NULL DEFAULT 3,
    max_suggest   INTEGER NOT NULL DEFAULT 5,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. SIGNALS — unified inbound triage feed ----------------------------------
CREATE TABLE IF NOT EXISTS signals (
    id            INTEGER PRIMARY KEY,
    type          TEXT NOT NULL,
    source        TEXT NOT NULL,
    source_skill  TEXT,                        -- which skill created this (badge)
    external_ref  TEXT UNIQUE,                  -- DEDUP KEY
    title         TEXT NOT NULL,
    summary       TEXT,
    who TEXT, what TEXT, when_rel TEXT, why TEXT,
    url           TEXT,
    person_id     INTEGER REFERENCES people(id),
    topic_id      INTEGER REFERENCES topics(id),
    priority      INTEGER NOT NULL DEFAULT 3,
    triage_rank   INTEGER,
    status        TEXT NOT NULL DEFAULT 'new',
    occurred_at   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_signals_feed ON signals(status, priority, occurred_at);

-- 5. TASKS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id               INTEGER PRIMARY KEY,
    title            TEXT NOT NULL,
    detail           TEXT,
    due_at           TEXT,
    priority         INTEGER NOT NULL DEFAULT 3,
    status           TEXT NOT NULL DEFAULT 'open',
    person_id        INTEGER REFERENCES people(id),
    source_signal_id INTEGER REFERENCES signals(id),
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. ALERTS -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id             INTEGER PRIMARY KEY,
    severity       TEXT NOT NULL DEFAULT 'info',
    title          TEXT NOT NULL,
    body           TEXT,
    url            TEXT,
    source_table   TEXT, source_id INTEGER,
    status         TEXT NOT NULL DEFAULT 'unread',
    notified_toast INTEGER NOT NULL DEFAULT 0,
    notified_push  INTEGER NOT NULL DEFAULT 0,  -- web push (container, tab-closed)
    repeat_count   INTEGER NOT NULL DEFAULT 0,  -- loud-alert repeat tracking
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_open ON alerts(status, severity, created_at);

-- 7. EVENTS -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id               INTEGER PRIMARY KEY,
    title            TEXT NOT NULL,
    body             TEXT,
    proposed_times   TEXT,
    chosen_time      TEXT,
    attendees        TEXT,
    status           TEXT NOT NULL DEFAULT 'suggested',
    source_signal_id INTEGER REFERENCES signals(id),
    external_ref     TEXT UNIQUE,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, created_at);

-- 8. LEARNING ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning (
    id            INTEGER PRIMARY KEY,
    kind          TEXT NOT NULL,
    source        TEXT NOT NULL,
    source_skill  TEXT,                         -- which skill created this (badge)
    title         TEXT NOT NULL,
    synopsis      TEXT,
    url           TEXT,
    external_ref  TEXT UNIQUE,
    provider      TEXT,
    event_at      TEXT,
    topic_id      INTEGER REFERENCES topics(id),
    relevance     INTEGER,
    status        TEXT NOT NULL DEFAULT 'suggested',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. CONFIG -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. SKILL_RUNS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_runs (
    id             INTEGER PRIMARY KEY,
    skill          TEXT NOT NULL,
    ran_at         TEXT NOT NULL DEFAULT (datetime('now')),
    window_start   TEXT,
    window_end     TEXT,
    items_created  INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'ok',
    note           TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_skill ON skill_runs(skill, ran_at);

-- updated_at touch triggers (one per table with updated_at) ------------------
CREATE TRIGGER IF NOT EXISTS trg_people_touch AFTER UPDATE ON people
BEGIN UPDATE people SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_topics_touch AFTER UPDATE ON topics
BEGIN UPDATE topics SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_signals_touch AFTER UPDATE ON signals
BEGIN UPDATE signals SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_tasks_touch AFTER UPDATE ON tasks
BEGIN UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_alerts_touch AFTER UPDATE ON alerts
BEGIN UPDATE alerts SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_events_touch AFTER UPDATE ON events
BEGIN UPDATE events SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_learning_touch AFTER UPDATE ON learning
BEGIN UPDATE learning SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_config_touch AFTER UPDATE ON config
BEGIN UPDATE config SET updated_at = datetime('now') WHERE key = NEW.key; END;

-- 11. ACTIONS ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actions (
    id           INTEGER PRIMARY KEY,
    entity_type  TEXT,
    entity_id    INTEGER,
    action_type  TEXT NOT NULL,
    mode         TEXT NOT NULL DEFAULT 'review',
    status       TEXT NOT NULL DEFAULT 'drafted',
    payload      TEXT,
    rationale    TEXT,
    created_by   TEXT NOT NULL DEFAULT 'skill',
    approved_at  TEXT,
    executed_at  TEXT,
    result       TEXT,
    error        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 12. GUIDANCE ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guidance (
    id          INTEGER PRIMARY KEY,
    scope       TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
