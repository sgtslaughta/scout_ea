# Base EA — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `EA_DB` — the SQLite schema, a thin Python DB layer, seed data, and the dedup/status/`data_version` primitives every later layer (web API, MCP server, skills) reuses.

**Architecture:** A shared Python package `ea` owns one SQLite file in WAL mode. `schema.sql` is the single DDL source (10 base tables + per-table `updated_at` triggers). `db.py` exposes connection setup (pragmas on), schema init, and four data primitives: `upsert_signal` (dedup on `external_ref`), `list_signals`, `update_status`, `data_version`. No web, no MCP yet — pure stdlib `sqlite3` + pytest.

**Tech Stack:** Python 3.11+ (stdlib `sqlite3`), pytest. No third-party runtime deps.

## Global Constraints

- DB layer is **stdlib `sqlite3` only** — no SQLAlchemy/ORM. (FastAPI/MCP arrive in later plans.)
- Every connection sets `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`.
- All timestamps stored UTC ISO-8601 via `datetime('now')` defaults.
- Dedup is `INSERT ... ON CONFLICT(external_ref) DO NOTHING`; never duplicate across windows.
- Enums stored as `TEXT`; priority scale `1=critical .. 5=info`.
- Package import path: tests run from `backend/` with `ea` importable (pyproject `pythonpath`).
- Files stay under 500 lines.

---

### Task 1: Schema + init

**Files:**
- Create: `backend/ea/__init__.py` (empty)
- Create: `backend/ea/schema.sql`
- Create: `backend/ea/db.py`
- Create: `backend/pyproject.toml`
- Test: `backend/tests/test_schema.py`

**Interfaces:**
- Produces: `ea.db.get_conn(db_path) -> sqlite3.Connection`, `ea.db.init_db(db_path, schema_path=DEFAULT_SCHEMA, seed_path=None) -> sqlite3.Connection`, module constant `ea.db.DEFAULT_SCHEMA` (Path to `schema.sql`).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_schema.py
import sqlite3
from ea import db

EXPECTED_TABLES = {
    "people", "person_handles", "topics", "signals", "tasks",
    "alerts", "events", "learning", "config", "skill_runs",
}

def test_init_creates_all_tables(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite")
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    names = {r["name"] for r in rows}
    assert EXPECTED_TABLES <= names

def test_pragmas_on(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite")
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert conn.execute("PRAGMA journal_mode").fetchone()[0].lower() == "wal"

def test_new_columns_present(tmp_path):
    # source_skill on signals/learning, notified_push on alerts (badge + web-push)
    conn = db.init_db(tmp_path / "ea.sqlite")
    sig = {r["name"] for r in conn.execute("PRAGMA table_info(signals)")}
    lrn = {r["name"] for r in conn.execute("PRAGMA table_info(learning)")}
    alt = {r["name"] for r in conn.execute("PRAGMA table_info(alerts)")}
    assert "source_skill" in sig
    assert "source_skill" in lrn
    assert "notified_push" in alt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'ea'`

- [ ] **Step 3: Create `backend/pyproject.toml`**

```toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "scout-ea"
version = "0.1.0"
requires-python = ">=3.11"

[tool.setuptools.packages.find]
include = ["ea*"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 4: Create `backend/ea/__init__.py`** (empty file)

- [ ] **Step 5: Create `backend/ea/schema.sql`**

```sql
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
```

- [ ] **Step 6: Create `backend/ea/db.py`**

```python
"""EA_DB access layer — stdlib sqlite3 only. Shared by web API, MCP, skills."""
from __future__ import annotations
import sqlite3
from pathlib import Path

DEFAULT_SCHEMA = Path(__file__).with_name("schema.sql")
DEFAULT_SEED = Path(__file__).with_name("seed.sql")


def get_conn(db_path) -> sqlite3.Connection:
    """Open a connection with EA pragmas on and Row factory."""
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db(db_path, schema_path=DEFAULT_SCHEMA, seed_path=None) -> sqlite3.Connection:
    """Create a connection and apply schema (+ optional seed). Idempotent."""
    conn = get_conn(db_path)
    conn.executescript(Path(schema_path).read_text())
    if seed_path is not None:
        conn.executescript(Path(seed_path).read_text())
    conn.commit()
    return conn
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_schema.py -v`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add backend/ea/__init__.py backend/ea/schema.sql backend/ea/db.py backend/pyproject.toml backend/tests/test_schema.py
git commit -m "feat: EA_DB schema + init (10 tables, triggers, badge/push columns)"
```

---

### Task 2: Seed config + sample data

**Files:**
- Create: `backend/ea/seed.sql`
- Modify: `backend/ea/db.py` (add `DEFAULT_SEED` already defined in Task 1 Step 6 — confirm present)
- Test: `backend/tests/test_seed.py`

**Interfaces:**
- Consumes: `ea.db.init_db`, `ea.db.DEFAULT_SEED`.
- Produces: a seeded DB with required `config` keys + ≥1 sample person/topic.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_seed.py
from ea import db

REQUIRED_CONFIG = {
    "tz", "work_hours", "work_days", "heartbeat_minutes",
    "priority_scale", "global_max_suggest", "web_port", "mcp_port",
}

def test_seed_loads_required_config(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    keys = {r["key"] for r in conn.execute("SELECT key FROM config")}
    assert REQUIRED_CONFIG <= keys

def test_seed_has_sample_person_and_topic(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    assert conn.execute("SELECT COUNT(*) FROM people").fetchone()[0] >= 1
    assert conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0] >= 1

def test_seed_is_idempotent(tmp_path):
    # init twice -> no duplicate config rows (INSERT OR IGNORE on PK)
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    n = conn.execute("SELECT COUNT(*) FROM config WHERE key='tz'").fetchone()[0]
    assert n == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_seed.py -v`
Expected: FAIL — `OperationalError` / missing `seed.sql` (file not found)

- [ ] **Step 3: Create `backend/ea/seed.sql`**

```sql
-- Config: INSERT OR IGNORE keeps seed idempotent across re-init.
INSERT OR IGNORE INTO config(key, value) VALUES
  ('tz',                'America/New_York'),
  ('work_hours',        '07:00-18:00'),
  ('work_days',         'Mon,Tue,Wed,Thu,Fri'),
  ('heartbeat_minutes', '30'),
  ('priority_scale',    '1=critical,2=high,3=normal,4=low,5=info'),
  ('global_max_suggest','25'),
  ('web_port',          '8765'),
  ('mcp_port',          '8766');

INSERT OR IGNORE INTO people(id, name, role, org, importance) VALUES
  (1, 'Dr. Vance', 'Regional VP', 'Acme', 1);

INSERT OR IGNORE INTO topics(id, name, description, priority) VALUES
  (1, 'AI agents', 'Autonomous agent frameworks and tooling', 2);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_seed.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/ea/seed.sql backend/tests/test_seed.py
git commit -m "feat: seed config + sample person/topic (idempotent)"
```

---

### Task 3: Data primitives — dedup insert, list, status update, data_version

**Files:**
- Modify: `backend/ea/db.py` (append functions)
- Test: `backend/tests/test_primitives.py`

**Interfaces:**
- Consumes: `ea.db.get_conn`, `ea.db.init_db`.
- Produces:
  - `ea.db.upsert_signal(conn, **fields) -> int` — returns inserted rowcount (1 new, 0 deduped).
  - `ea.db.list_signals(conn, status=None) -> list[sqlite3.Row]` — newest first.
  - `ea.db.update_status(conn, table, row_id, status) -> int` — rows affected; `table` whitelisted.
  - `ea.db.data_version(conn) -> int` — `PRAGMA data_version` value.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_primitives.py
import pytest
from ea import db

def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)

def test_upsert_dedups_on_external_ref(tmp_path):
    conn = _conn(tmp_path)
    f = dict(type="email", source="outlook", external_ref="msg-1", title="Hi")
    assert db.upsert_signal(conn, **f) == 1          # inserted
    assert db.upsert_signal(conn, **f) == 0          # deduped, no second row
    assert conn.execute("SELECT COUNT(*) FROM signals").fetchone()[0] == 1

def test_list_signals_filters_by_status(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="outlook", external_ref="a", title="A")
    db.upsert_signal(conn, type="teams", source="teams", external_ref="b", title="B")
    db.update_status(conn, "signals", 1, "dismissed")
    new_rows = db.list_signals(conn, status="new")
    assert [r["external_ref"] for r in new_rows] == ["b"]

def test_update_status_rejects_unknown_table(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.update_status(conn, "robert'); DROP TABLE signals;--", 1, "done")

def test_data_version_bumps_on_external_write(tmp_path):
    # data_version only changes for OTHER connections' commits -> use two conns
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    reader = db.get_conn(p)
    writer = db.get_conn(p)
    before = db.data_version(reader)
    db.upsert_signal(writer, type="email", source="outlook", external_ref="x", title="X")
    after = db.data_version(reader)
    assert after != before
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_primitives.py -v`
Expected: FAIL — `AttributeError: module 'ea.db' has no attribute 'upsert_signal'`

- [ ] **Step 3: Append to `backend/ea/db.py`**

```python
# --- data primitives -------------------------------------------------------

_STATUS_TABLES = {"signals", "tasks", "alerts", "events", "learning"}


def upsert_signal(conn, **fields) -> int:
    """Insert a signal, deduping on external_ref. Returns rowcount (1 new, 0 dup)."""
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO signals ({cols}) VALUES ({placeholders}) "
        "ON CONFLICT(external_ref) DO NOTHING",
        list(fields.values()),
    )
    conn.commit()
    return cur.rowcount


def list_signals(conn, status=None):
    """Return signal rows (newest first), optionally filtered by status."""
    if status is None:
        return conn.execute(
            "SELECT * FROM signals ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return conn.execute(
        "SELECT * FROM signals WHERE status = ? ORDER BY created_at DESC, id DESC",
        (status,),
    ).fetchall()


def update_status(conn, table, row_id, status) -> int:
    """Set status on a whitelisted table's row. Returns rows affected."""
    if table not in _STATUS_TABLES:
        raise ValueError(f"status updates not allowed on table {table!r}")
    cur = conn.execute(
        f"UPDATE {table} SET status = ? WHERE id = ?", (status, row_id)
    )
    conn.commit()
    return cur.rowcount


def data_version(conn) -> int:
    """PRAGMA data_version — changes when another connection commits a write."""
    return conn.execute("PRAGMA data_version").fetchone()[0]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_primitives.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_primitives.py
git commit -m "feat: data primitives — dedup upsert, list, status update, data_version"
```

---

### Task 4: CLI initializer + full suite green

**Files:**
- Create: `backend/ea/init_db.py`
- Test: `backend/tests/test_cli.py`

**Interfaces:**
- Consumes: `ea.db.init_db`, `ea.db.DEFAULT_SEED`.
- Produces: `python -m ea.init_db <db_path>` creates a seeded DB; `ea.init_db.main(argv) -> int`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_cli.py
from ea import init_db, db

def test_cli_creates_seeded_db(tmp_path):
    target = tmp_path / "ea.sqlite"
    rc = init_db.main([str(target)])
    assert rc == 0
    assert target.exists()
    conn = db.get_conn(target)
    assert conn.execute("SELECT COUNT(*) FROM config").fetchone()[0] >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_cli.py -v`
Expected: FAIL — `ImportError: cannot import name 'init_db' from 'ea'` (no module `ea.init_db`)

- [ ] **Step 3: Create `backend/ea/init_db.py`**

```python
"""CLI: python -m ea.init_db <db_path>  — create/upgrade a seeded EA_DB."""
from __future__ import annotations
import sys
from . import db


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print("usage: python -m ea.init_db <db_path>", file=sys.stderr)
        return 2
    db.init_db(argv[0], seed_path=db.DEFAULT_SEED)
    print(f"initialized {argv[0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run the full suite to verify everything passes**

Run: `cd backend && python -m pytest -v`
Expected: PASS (all tests across the 4 test files)

- [ ] **Step 5: Commit**

```bash
git add backend/ea/init_db.py backend/tests/test_cli.py
git commit -m "feat: ea.init_db CLI; full data-foundation suite green"
```

---

## Self-Review

**Spec coverage (base spec §2 + UI/feature schema adds):**
- 10 base tables + indexes + `updated_at` triggers → Task 1. ✓
- `source_skill` (signals, learning) + `alerts.notified_push` adds → Task 1 (`test_new_columns_present`). ✓
- Seed `config` + sample people/topics → Task 2. ✓
- Dedup-on-`external_ref`, status writes, `data_version` (the SSE/control-loop primitives later plans consume) → Task 3. ✓
- One-command DB init for container/dev → Task 4. ✓

**Deferred to later plans (not this one):** feature tables `critical_deadlines`/`trends`/`trend_findings` + their `source_skill` (feature migration); FastAPI + SSE endpoints (Plan B); MCP server (Plan C); React (Plan D); skills (Plan E); container (Plan F). Feature config keys (`outlook_send_time`, `trend_window_days`, `embed_model`, `deadlines_visible_global`) seed with the feature migration.

**Placeholder scan:** none — every step has complete file content or exact commands.

**Type consistency:** `get_conn`/`init_db`/`DEFAULT_SCHEMA`/`DEFAULT_SEED`/`upsert_signal`/`list_signals`/`update_status`/`data_version` names are identical across tasks and tests.

**Note for executor:** `data_version` is connection-local — it only changes in response to *other* connections' commits. Task 3's test deliberately uses two connections; don't "simplify" it to one (it would falsely fail).
