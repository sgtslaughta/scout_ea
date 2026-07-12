"""EA_DB access layer — stdlib sqlite3 only. Shared by web API, MCP, skills."""
from __future__ import annotations
import json
import sqlite3
from pathlib import Path

DEFAULT_SCHEMA = Path(__file__).with_name("schema.sql")
DEFAULT_SEED = Path(__file__).with_name("seed.sql")
DEFAULT_FEATURES = Path(__file__).with_name("features.sql")


def get_conn(db_path) -> sqlite3.Connection:
    """Open a connection with EA pragmas on and Row factory."""
    # per-request/sequential use across FastAPI threadpool threads; never shared concurrently
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db(db_path, schema_path=DEFAULT_SCHEMA, seed_path=None) -> sqlite3.Connection:
    """Create a connection and apply schema (+ optional seed). Idempotent."""
    conn = get_conn(db_path)
    conn.executescript(Path(schema_path).read_text())
    conn.executescript(Path(DEFAULT_FEATURES).read_text())
    _migrate(conn)
    if seed_path is not None:
        conn.executescript(Path(seed_path).read_text())
    conn.commit()
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    """Apply idempotent migrations: ADD board_column_id column if missing, seed board_columns."""
    # Check if tasks table has board_column_id column
    pragma = conn.execute("PRAGMA table_info(tasks)").fetchall()
    has_board_column_id = any(r[1] == "board_column_id" for r in pragma)

    if not has_board_column_id:
        conn.execute("ALTER TABLE tasks ADD COLUMN board_column_id INTEGER REFERENCES board_columns(id)")
        conn.commit()

    # Add board_columns.status for pre-existing DBs (fresh DBs get it from features.sql).
    board_pragma = conn.execute("PRAGMA table_info(board_columns)").fetchall()
    if not any(r[1] == "status" for r in board_pragma):
        conn.execute("ALTER TABLE board_columns ADD COLUMN status TEXT NOT NULL DEFAULT 'open'")
        conn.execute("UPDATE board_columns SET status='in_progress' WHERE name='In Progress'")
        conn.execute("UPDATE board_columns SET status='done' WHERE name='Done'")
        conn.commit()

    # Check if board_columns is empty and seed default columns once
    count = conn.execute("SELECT COUNT(*) as c FROM board_columns").fetchone()["c"]
    if count == 0:
        conn.execute("INSERT INTO board_columns (name, position, status) VALUES (?, ?, ?)", ("To Do", 0, "open"))
        conn.execute("INSERT INTO board_columns (name, position, status) VALUES (?, ?, ?)", ("In Progress", 1, "in_progress"))
        conn.execute("INSERT INTO board_columns (name, position, status) VALUES (?, ?, ?)", ("Done", 2, "done"))
        conn.commit()

        # Map existing tasks by status
        to_do_id = conn.execute("SELECT id FROM board_columns WHERE name='To Do'").fetchone()["id"]
        in_progress_id = conn.execute("SELECT id FROM board_columns WHERE name='In Progress'").fetchone()["id"]
        done_id = conn.execute("SELECT id FROM board_columns WHERE name='Done'").fetchone()["id"]

        conn.execute("UPDATE tasks SET board_column_id=? WHERE status=?", (to_do_id, "open"))
        conn.execute("UPDATE tasks SET board_column_id=? WHERE status IN (?, ?)", (done_id, "done", "dismissed"))
        conn.execute("UPDATE tasks SET board_column_id=? WHERE status=?", (in_progress_id, "in_progress"))
        conn.commit()

    # Migration 006: fold deadline_tags/deadline_links into the universal tables.
    tbls = {r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    if "deadline_tags" in tbls or "deadline_links" in tbls:
        already = conn.execute(
            "SELECT COUNT(*) FROM content_tags WHERE ref_type='deadline'").fetchone()[0]
        already += conn.execute(
            "SELECT COUNT(*) FROM content_links WHERE ref_type='deadline'").fetchone()[0]
        if already == 0:
            if "deadline_tags" in tbls:
                for row in conn.execute("SELECT deadline_id, tag FROM deadline_tags").fetchall():
                    tag_content(conn, "deadline", row[0], row[1])
            if "deadline_links" in tbls:
                for row in conn.execute(
                        "SELECT deadline_id, ref_type, ref_id FROM deadline_links").fetchall():
                    # old ref_type (person/task/event) becomes target_type; raw insert
                    # (bypasses target whitelist) so task/event still migrate, label falls back.
                    conn.execute(
                        "INSERT OR IGNORE INTO content_links (ref_type, ref_id, target_type, target_id) "
                        "VALUES ('deadline', ?, ?, ?)", (row[0], row[1], row[2]))
        conn.execute("DROP TABLE IF EXISTS deadline_tags")
        conn.execute("DROP TABLE IF EXISTS deadline_links")
        conn.commit()

    # Add alerts.repeat_count for pre-existing DBs (fresh DBs get it from schema.sql).
    alerts_pragma = conn.execute("PRAGMA table_info(alerts)").fetchall()
    if not any(r[1] == "repeat_count" for r in alerts_pragma):
        conn.execute("ALTER TABLE alerts ADD COLUMN repeat_count INTEGER NOT NULL DEFAULT 0")
        conn.commit()

    # Add signals.reasoning for pre-existing DBs (fresh DBs get it from schema.sql).
    signals_pragma = conn.execute("PRAGMA table_info(signals)").fetchall()
    if not any(r[1] == "reasoning" for r in signals_pragma):
        conn.execute("ALTER TABLE signals ADD COLUMN reasoning TEXT")
        conn.commit()


# --- data primitives -------------------------------------------------------

_STATUS_TABLES = {"signals", "tasks", "alerts", "events", "learning", "news_items"}

_SIGNAL_COLS = {"type", "source", "source_skill", "external_ref", "title", "summary",
                "who", "what", "when_rel", "why", "reasoning", "url", "person_id", "topic_id",
                "priority", "triage_rank", "status", "occurred_at"}


def upsert_signal(conn: sqlite3.Connection, **fields) -> int:
    """Insert a signal, deduping on external_ref. Returns rowcount (1 new, 0 dup).

    Requires 'external_ref' in fields. Column names validated against _SIGNAL_COLS.
    """
    if "external_ref" not in fields:
        raise ValueError("upsert_signal requires 'external_ref' in fields")
    bad = set(fields) - _SIGNAL_COLS
    if bad:
        raise ValueError(f"unknown signal columns: {bad}")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO signals ({cols}) VALUES ({placeholders}) "
        "ON CONFLICT(external_ref) DO NOTHING",
        list(fields.values()),
    )
    conn.commit()
    return cur.rowcount


def list_signals(conn: sqlite3.Connection, status: str | None = None) -> list[sqlite3.Row]:
    """Return signal rows, newest by created_at DESC then id DESC (tie-break)."""
    if status is None:
        return conn.execute(
            "SELECT * FROM signals ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return conn.execute(
        "SELECT * FROM signals WHERE status = ? ORDER BY created_at DESC, id DESC",
        (status,),
    ).fetchall()


def update_status(conn: sqlite3.Connection, table: str, row_id: int, status: str) -> int:
    """Set status on a whitelisted table's row. Returns rows affected."""
    if table not in _STATUS_TABLES:
        raise ValueError(f"status updates not allowed on table {table!r}")
    cur = conn.execute(
        f"UPDATE {table} SET status = ? WHERE id = ?", (status, row_id)
    )
    conn.commit()
    return cur.rowcount


def data_version(conn: sqlite3.Connection) -> int:
    """PRAGMA data_version — changes when another connection commits a write."""
    return conn.execute("PRAGMA data_version").fetchone()[0]


# --- deadline helpers ------------------------------------------------------

_DEADLINE_COLS = {"title", "detail", "due_at", "source", "source_skill", "external_ref",
                  "person_id", "signal_id", "priority", "visible", "status"}


def add_deadline(conn: sqlite3.Connection, **fields) -> int:
    """Insert a critical deadline, deduping on external_ref. Returns rowcount.

    Requires 'external_ref'. Column names validated against _DEADLINE_COLS.
    """
    if "external_ref" not in fields:
        raise ValueError("add_deadline requires 'external_ref' in fields")
    bad = set(fields) - _DEADLINE_COLS
    if bad:
        raise ValueError(f"unknown deadline columns: {bad}")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO critical_deadlines ({cols}) VALUES ({placeholders}) "
        "ON CONFLICT(external_ref) DO NOTHING",
        list(fields.values()),
    )
    conn.commit()
    return cur.rowcount


def list_deadlines(conn: sqlite3.Connection, respect_global: bool = True,
                   include_hidden: bool = False) -> list[sqlite3.Row]:
    """Active deadlines ordered by due_at asc.

    Returns [] when respect_global and config.deadlines_visible_global != '1'.
    include_hidden=True also returns visible=0 rows (for a 'show hidden' view).
    """
    if respect_global:
        row = conn.execute(
            "SELECT value FROM config WHERE key='deadlines_visible_global'"
        ).fetchone()
        if row is None or row["value"] != "1":
            return []
    vis = "" if include_hidden else "AND visible=1"
    return conn.execute(
        f"SELECT * FROM critical_deadlines WHERE status='active' {vis} ORDER BY due_at ASC"
    ).fetchall()


def set_deadline_visible(conn: sqlite3.Connection, deadline_id: int, visible: bool) -> int:
    """Set per-row visibility (1/0). Returns rows affected."""
    cur = conn.execute(
        "UPDATE critical_deadlines SET visible=? WHERE id=?",
        (1 if visible else 0, deadline_id),
    )
    conn.commit()
    return cur.rowcount


def update_deadline(conn: sqlite3.Connection, deadline_id: int, **fields) -> int:
    """Update a deadline row. Columns validated against _DEADLINE_COLS. Returns rows affected."""
    bad = set(fields) - _DEADLINE_COLS
    if bad:
        raise ValueError(f"unknown deadline columns: {bad}")
    if not fields:
        return 0
    sets = ", ".join(f"{k}=?" for k in fields)
    cur = conn.execute(
        f"UPDATE critical_deadlines SET {sets} WHERE id=?", [*fields.values(), deadline_id]
    )
    conn.commit()
    return cur.rowcount


# --- deadline cross-references (links + tags) ------------------------------

# ref_type -> label-lookup SQL. Whitelist doubles as ref_type validation.
# --- universal tags & links ------------------------------------------------

_TAGGABLE_TYPES = {"deadline", "task", "signal", "event", "trend", "trend_finding",
                   "learning", "news", "person", "topic"}
# target_type -> label-lookup SQL. Whitelist doubles as target_type validation.
_LINK_TARGET_SQL = {
    "person": "SELECT name AS label FROM people WHERE id=?",
    "topic":  "SELECT name AS label FROM topics WHERE id=?",
}


def _check_ref_type(ref_type: str) -> None:
    if ref_type not in _TAGGABLE_TYPES:
        raise ValueError(f"unknown ref_type: {ref_type!r}")


def link_content(conn: sqlite3.Connection, ref_type: str, ref_id: int, target_type: str, target_id: int) -> int:
    """Link a content row to a person/topic. Idempotent. Returns rowcount."""
    _check_ref_type(ref_type)
    if target_type not in _LINK_TARGET_SQL:
        raise ValueError(f"unknown target_type: {target_type!r}")
    cur = conn.execute(
        "INSERT INTO content_links (ref_type, ref_id, target_type, target_id) VALUES (?,?,?,?) "
        "ON CONFLICT(ref_type, ref_id, target_type, target_id) DO NOTHING",
        (ref_type, ref_id, target_type, target_id),
    )
    conn.commit()
    return cur.rowcount


def unlink_content(conn: sqlite3.Connection, link_id: int) -> int:
    """Delete a content link by id. Returns rows affected."""
    cur = conn.execute("DELETE FROM content_links WHERE id=?", (link_id,))
    conn.commit()
    return cur.rowcount


def list_links_for(conn: sqlite3.Connection, ref_type: str, ref_id: int) -> list[dict]:
    """Links on a content row with resolved labels: [{id, target_type, target_id, label}]."""
    _check_ref_type(ref_type)
    rows = conn.execute(
        "SELECT id, target_type, target_id FROM content_links WHERE ref_type=? AND ref_id=? ORDER BY id",
        (ref_type, ref_id),
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        sql = _LINK_TARGET_SQL.get(r["target_type"])
        lbl = conn.execute(sql, (r["target_id"],)).fetchone() if sql else None
        d["label"] = lbl["label"] if lbl else f'{r["target_type"]} #{r["target_id"]}'
        out.append(d)
    return out


def get_or_create_tag(conn: sqlite3.Connection, name: str, color: str = "neutral") -> int:
    """Return the id of the tag named `name`, creating it (with `color`) if absent."""
    name = name.strip()
    if not name:
        raise ValueError("tag name cannot be empty")
    row = conn.execute("SELECT id FROM tags WHERE name=?", (name,)).fetchone()
    if row:
        return row["id"]
    cur = conn.execute("INSERT INTO tags (name, color) VALUES (?,?)", (name, color))
    conn.commit()
    return cur.lastrowid


def tag_content(conn: sqlite3.Connection, ref_type: str, ref_id: int, name: str, color: str = "neutral") -> int:
    """Attach tag `name` to a content row. Idempotent. Returns rowcount."""
    _check_ref_type(ref_type)
    tag_id = get_or_create_tag(conn, name, color)
    cur = conn.execute(
        "INSERT INTO content_tags (tag_id, ref_type, ref_id) VALUES (?,?,?) "
        "ON CONFLICT(tag_id, ref_type, ref_id) DO NOTHING",
        (tag_id, ref_type, ref_id),
    )
    conn.commit()
    return cur.rowcount


def untag_content(conn: sqlite3.Connection, ref_type: str, ref_id: int, tag_id: int) -> int:
    """Detach a tag from a content row. Returns rows affected."""
    _check_ref_type(ref_type)
    cur = conn.execute(
        "DELETE FROM content_tags WHERE ref_type=? AND ref_id=? AND tag_id=?",
        (ref_type, ref_id, tag_id),
    )
    conn.commit()
    return cur.rowcount


def list_tags_for(conn: sqlite3.Connection, ref_type: str, ref_id: int) -> list[dict]:
    """Tags on a content row: [{tag_id, name, color}]."""
    _check_ref_type(ref_type)
    rows = conn.execute(
        "SELECT t.id AS tag_id, t.name, t.color FROM content_tags c "
        "JOIN tags t ON t.id=c.tag_id WHERE c.ref_type=? AND c.ref_id=? ORDER BY t.name",
        (ref_type, ref_id),
    ).fetchall()
    return [dict(r) for r in rows]


def list_all_tags(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """All tags [{id, name, color}] for pickers."""
    return conn.execute("SELECT id, name, color FROM tags ORDER BY name").fetchall()


def content_ids_by_tag(conn: sqlite3.Connection, tag_id: int, ref_type: str | None = None) -> list[dict]:
    """[{ref_type, ref_id}] for everything carrying `tag_id` (optionally one ref_type)."""
    if ref_type is not None:
        _check_ref_type(ref_type)
        rows = conn.execute(
            "SELECT ref_type, ref_id FROM content_tags WHERE tag_id=? AND ref_type=?",
            (tag_id, ref_type),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT ref_type, ref_id FROM content_tags WHERE tag_id=?", (tag_id,)
        ).fetchall()
    return [dict(r) for r in rows]


# --- data feed: learning + news -------------------------------------------

_LEARNING_COLS = {"kind", "source", "source_skill", "title", "synopsis", "url",
                  "external_ref", "provider", "event_at", "topic_id", "relevance", "status"}
_NEWS_COLS = {"title", "url", "synopsis", "external_ref", "topic_id", "source",
              "source_skill", "event_at", "relevance", "status"}


def _list_feed_table(conn, table, status, topic_id):
    """Shared reader for learning/news_items: newest first, dated rows above undated."""
    where, params = [], []
    if status is not None:
        where.append("status=?"); params.append(status)
    if topic_id is not None:
        where.append("topic_id=?"); params.append(topic_id)
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    return conn.execute(
        f"SELECT * FROM {table}{clause} ORDER BY event_at IS NULL, event_at DESC, id DESC",
        params,
    ).fetchall()


def list_learning(conn: sqlite3.Connection, status: str | None = None, topic_id: int | None = None) -> list[sqlite3.Row]:
    """Learning items, newest by event_at (dated first), then id desc."""
    return _list_feed_table(conn, "learning", status, topic_id)


def list_news(conn: sqlite3.Connection, status: str | None = None, topic_id: int | None = None) -> list[sqlite3.Row]:
    """News items, newest by event_at (dated first), then id desc."""
    return _list_feed_table(conn, "news_items", status, topic_id)


def _insert_dedup(conn, table, cols_whitelist, fields):
    if "external_ref" not in fields:
        raise ValueError(f"{table} insert requires 'external_ref'")
    bad = set(fields) - cols_whitelist
    if bad:
        raise ValueError(f"unknown {table} columns: {bad}")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT(external_ref) DO NOTHING",
        list(fields.values()),
    )
    conn.commit()
    return cur.rowcount


def add_learning(conn: sqlite3.Connection, **fields) -> int:
    """Insert a learning item, deduping on external_ref. Returns rowcount."""
    return _insert_dedup(conn, "learning", _LEARNING_COLS, fields)


def add_news_item(conn: sqlite3.Connection, **fields) -> int:
    """Insert a news item, deduping on external_ref. Returns rowcount."""
    return _insert_dedup(conn, "news_items", _NEWS_COLS, fields)


def tag_id_by_name(conn: sqlite3.Connection, name: str) -> int | None:
    """Return a tag's id by exact name, or None. Used by feed origin/tag filters."""
    row = conn.execute("SELECT id FROM tags WHERE name=?", (name.strip(),)).fetchone()
    return row["id"] if row else None


# --- config helpers --------------------------------------------------------

# NOTE: WRITABLE_CONFIG is a deliberate security allowlist; only specific config keys
# can be modified by end users. Add new keys here explicitly after schema migration.
WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days",
                   "reminder_enabled", "reminder_lead_minutes",
                   "alert_loud_threshold", "alert_sound_enabled"}


def set_config(conn: sqlite3.Connection, key: str, value: str) -> None:
    """Upsert a writable config key. Raises ValueError for non-whitelisted keys."""
    if key not in WRITABLE_CONFIG:
        raise ValueError(f"config key not writable: {key}")
    conn.execute(
        "INSERT INTO config(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, str(value)),
    )
    conn.commit()


# --- trend helpers ---------------------------------------------------------

def upsert_trend(conn: sqlite3.Connection, term: str, kind: str, window_start: str,
                 window_end: str, score: float = 0, count: int = 0, delta: str | None = None,
                 sources: str | None = None, source_skill: str | None = None) -> int:
    """Upsert a trend on (term, window_start). Returns the row id.

    ON CONFLICT: score, count, delta, window_end, sources are updated;
    source_skill is NOT updated (first-writer-wins, preserves original creator).
    """
    conn.execute(
        "INSERT INTO trends (term, kind, window_start, window_end, score, count, "
        "delta, sources, source_skill) VALUES (?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(term, window_start) DO UPDATE SET "
        "score=excluded.score, count=excluded.count, delta=excluded.delta, "
        "window_end=excluded.window_end, sources=excluded.sources",
        (term, kind, window_start, window_end, score, count, delta, sources, source_skill),
    )
    conn.commit()
    row = conn.execute(
        "SELECT id FROM trends WHERE term=? AND window_start=?", (term, window_start)
    ).fetchone()
    return row["id"]


def list_trends(conn: sqlite3.Connection, window_start: str) -> list[sqlite3.Row]:
    """Trends for a window, highest score first."""
    return conn.execute(
        "SELECT * FROM trends WHERE window_start=? ORDER BY score DESC, term ASC",
        (window_start,),
    ).fetchall()


def latest_trend_window(conn: sqlite3.Connection) -> str | None:
    """Return the most recent window_start present in trends, or None."""
    row = conn.execute("SELECT MAX(window_start) AS w FROM trends").fetchone()
    return row["w"] if row and row["w"] is not None else None


_FINDING_COLS = {"trend_id", "topic_id", "title", "synopsis", "url",
                 "source", "source_skill", "external_ref", "relevance"}


def add_trend_finding(conn: sqlite3.Connection, **fields) -> int:
    """Insert a trend finding, deduping on external_ref (the URL). Returns rowcount."""
    if "external_ref" not in fields:
        raise ValueError("add_trend_finding requires 'external_ref' in fields")
    bad = set(fields) - _FINDING_COLS
    if bad:
        raise ValueError(f"unknown trend_finding columns: {bad}")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO trend_findings ({cols}) VALUES ({placeholders}) "
        "ON CONFLICT(external_ref) DO NOTHING",
        list(fields.values()),
    )
    conn.commit()
    return cur.rowcount


_TASK_COLS = {"title", "detail", "due_at", "priority", "status",
              "person_id", "source_signal_id", "board_column_id"}


def add_task(conn: sqlite3.Connection, **fields) -> int:
    """Insert a task row; returns the new id. Columns validated against _TASK_COLS."""
    bad = set(fields) - _TASK_COLS
    if bad:
        raise ValueError(f"unknown task columns: {bad}")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO tasks ({cols}) VALUES ({placeholders})", list(fields.values())
    )
    conn.commit()
    return cur.lastrowid


def update_task(conn: sqlite3.Connection, task_id: int, **fields) -> int:
    """Update a task row. Returns rows affected. Columns validated against _TASK_COLS."""
    bad = set(fields) - _TASK_COLS
    if bad:
        raise ValueError(f"unknown task columns: {bad}")
    if not fields:
        return 0
    sets = ", ".join(f"{k}=?" for k in fields)
    cur = conn.execute(f"UPDATE tasks SET {sets} WHERE id=?", [*fields.values(), task_id])
    conn.commit()
    return cur.rowcount


def add_skill_run(conn: sqlite3.Connection, skill: str, window_start: str | None = None,
                  window_end: str | None = None, items_created: int = 0, status: str = "ok",
                  note: str | None = None) -> int:
    """Record a skill run in skill_runs (audit + lookback anchor). Returns the new id."""
    cur = conn.execute(
        "INSERT INTO skill_runs (skill, window_start, window_end, items_created, status, note) "
        "VALUES (?,?,?,?,?,?)",
        (skill, window_start, window_end, items_created, status, note),
    )
    conn.commit()
    return cur.lastrowid


def list_skill_runs(conn, limit=20):
    """Recent skill runs (audit feed), newest first."""
    return conn.execute(
        "SELECT * FROM skill_runs ORDER BY ran_at DESC, id DESC LIMIT ?",
        (int(limit),),
    ).fetchall()


# --- people helpers --------------------------------------------------------

_PERSON_COLS = {"name", "role", "org", "importance", "notes", "active"}


def list_people(conn: sqlite3.Connection, include_inactive: bool = False) -> list[sqlite3.Row]:
    """Return people sorted by importance, name. Excludes inactive by default."""
    if include_inactive:
        return conn.execute("SELECT * FROM people ORDER BY importance, name").fetchall()
    return conn.execute("SELECT * FROM people WHERE active=1 ORDER BY importance, name").fetchall()


def add_person(conn: sqlite3.Connection, **fields) -> int:
    """Insert a person row; returns the new id. Columns validated against _PERSON_COLS."""
    bad = set(fields) - _PERSON_COLS
    if bad:
        raise ValueError(f"unknown person columns: {bad}")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO people ({cols}) VALUES ({placeholders})", list(fields.values())
    )
    conn.commit()
    return cur.lastrowid


def update_person(conn: sqlite3.Connection, person_id: int, **fields) -> int:
    """Update a person row. Returns rows affected. Columns validated against _PERSON_COLS."""
    bad = set(fields) - _PERSON_COLS
    if bad:
        raise ValueError(f"unknown person columns: {bad}")
    if not fields:
        return 0
    sets = ", ".join(f"{k}=?" for k in fields)
    cur = conn.execute(f"UPDATE people SET {sets} WHERE id=?", [*fields.values(), person_id])
    conn.commit()
    return cur.rowcount


def deactivate_person(conn: sqlite3.Connection, person_id: int) -> int:
    """Soft-delete a person by setting active=0. Returns rows affected."""
    cur = conn.execute("UPDATE people SET active=0 WHERE id=?", (person_id,))
    conn.commit()
    return cur.rowcount


# --- topics helpers --------------------------------------------------------

_TOPIC_COLS = {"name", "description", "priority", "max_suggest", "active"}


def list_topics(conn: sqlite3.Connection, include_inactive: bool = False) -> list[sqlite3.Row]:
    """Return topics sorted by priority, name. Excludes inactive by default."""
    if include_inactive:
        return conn.execute("SELECT * FROM topics ORDER BY priority, name").fetchall()
    return conn.execute("SELECT * FROM topics WHERE active=1 ORDER BY priority, name").fetchall()


def add_topic(conn: sqlite3.Connection, **fields) -> int:
    """Insert a topic row; returns the new id. Columns validated against _TOPIC_COLS."""
    bad = set(fields) - _TOPIC_COLS
    if bad:
        raise ValueError(f"unknown topic columns: {bad}")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO topics ({cols}) VALUES ({placeholders})", list(fields.values())
    )
    conn.commit()
    return cur.lastrowid


def update_topic(conn: sqlite3.Connection, topic_id: int, **fields) -> int:
    """Update a topic row. Returns rows affected. Columns validated against _TOPIC_COLS."""
    bad = set(fields) - _TOPIC_COLS
    if bad:
        raise ValueError(f"unknown topic columns: {bad}")
    if not fields:
        return 0
    sets = ", ".join(f"{k}=?" for k in fields)
    cur = conn.execute(f"UPDATE topics SET {sets} WHERE id=?", [*fields.values(), topic_id])
    conn.commit()
    return cur.rowcount


def deactivate_topic(conn: sqlite3.Connection, topic_id: int) -> int:
    """Soft-delete a topic by setting active=0. Returns rows affected."""
    cur = conn.execute("UPDATE topics SET active=0 WHERE id=?", (topic_id,))
    conn.commit()
    return cur.rowcount


# --- push subscription helpers ---------------------------------------------

def add_subscription(conn: sqlite3.Connection, endpoint: str, p256dh: str, auth: str) -> int:
    """Add or update a push subscription. Returns rowcount (1 upserted)."""
    cur = conn.execute(
        "INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?,?,?) "
        "ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth",
        (endpoint, p256dh, auth))
    conn.commit()
    return cur.rowcount


def list_subscriptions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Return all push subscriptions."""
    return conn.execute("SELECT * FROM push_subscriptions").fetchall()


def delete_subscription(conn: sqlite3.Connection, endpoint: str) -> int:
    """Delete a push subscription by endpoint. Returns rows affected."""
    cur = conn.execute("DELETE FROM push_subscriptions WHERE endpoint=?", (endpoint,))
    conn.commit()
    return cur.rowcount


# --- board column helpers --------------------------------------------------

def list_board_columns(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Return board columns ordered by position, id."""
    return conn.execute("SELECT * FROM board_columns ORDER BY position, id").fetchall()


def add_board_column(conn: sqlite3.Connection, name: str, status: str = "open") -> int:
    """Insert a board column with position = max(position)+1. Returns the new id."""
    max_pos = conn.execute("SELECT COALESCE(MAX(position), -1) as m FROM board_columns").fetchone()["m"]
    cur = conn.execute(
        "INSERT INTO board_columns (name, position, status) VALUES (?, ?, ?)",
        (name, max_pos + 1, status)
    )
    conn.commit()
    return cur.lastrowid


def update_board_column(conn: sqlite3.Connection, col_id: int, **fields) -> int:
    """Update a board column. Returns rows affected. Columns validated against {name, position}."""
    allowed = {"name", "position", "status"}
    bad = set(fields) - allowed
    if bad:
        raise ValueError(f"unknown board_column columns: {bad}")
    if not fields:
        return 0
    sets = ", ".join(f"{k}=?" for k in fields)
    cur = conn.execute(f"UPDATE board_columns SET {sets} WHERE id=?", [*fields.values(), col_id])
    conn.commit()
    return cur.rowcount


def delete_board_column(conn: sqlite3.Connection, col_id: int) -> int:
    """Delete a board column. Reassigns its tasks to the lowest-position remaining column.
    Returns rows affected (the column itself)."""
    # Find lowest-position remaining column (excluding the one being deleted)
    replacement = conn.execute(
        "SELECT id FROM board_columns WHERE id != ? ORDER BY position LIMIT 1", (col_id,)
    ).fetchone()
    replacement_id = replacement["id"] if replacement else None

    # Reassign tasks if there's a replacement column
    if replacement_id:
        conn.execute("UPDATE tasks SET board_column_id=? WHERE board_column_id=?", (replacement_id, col_id))

    # Delete the column
    cur = conn.execute("DELETE FROM board_columns WHERE id=?", (col_id,))
    conn.commit()
    return cur.rowcount


# --- action helpers --------------------------------------------------------

_ACTION_COLS = {"entity_type", "entity_id", "action_type", "mode", "status",
                "payload", "rationale", "created_by"}


def _decode_action(row: sqlite3.Row) -> dict:
    d = dict(row)
    for k in ("payload", "result"):
        d[k] = json.loads(d[k]) if d.get(k) else None
    return d


def add_action(conn, *, action_type, entity_type=None, entity_id=None,
               mode="review", status="drafted", payload=None, rationale=None,
               created_by="skill") -> int:
    fields = {"action_type": action_type, "entity_type": entity_type,
              "entity_id": entity_id, "mode": mode, "status": status,
              "payload": json.dumps(payload) if payload is not None else None,
              "rationale": rationale, "created_by": created_by}
    fields = {k: v for k, v in fields.items() if v is not None}
    bad = set(fields) - _ACTION_COLS
    if bad:
        raise ValueError(f"unknown action columns: {bad}")
    cols = ", ".join(fields)
    ph = ", ".join("?" for _ in fields)
    cur = conn.execute(f"INSERT INTO actions ({cols}) VALUES ({ph})",
                       list(fields.values()))
    conn.commit()
    return cur.lastrowid


def list_actions(conn, status=None, mode=None) -> list:
    sql = "SELECT * FROM actions"
    clauses, params = [], []
    if status is not None:
        clauses.append("status=?"); params.append(status)
    if mode is not None:
        clauses.append("mode=?"); params.append(mode)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY created_at DESC, id DESC"
    return [_decode_action(r) for r in conn.execute(sql, params).fetchall()]


def update_action(conn, action_id, *, status=None, result=None, error=None) -> int:
    sets, params = ["updated_at=datetime('now')"], []
    if status is not None:
        sets.append("status=?"); params.append(status)
        if status == "approved":
            sets.append("approved_at=datetime('now')")
        if status in ("completed", "failed"):
            sets.append("executed_at=datetime('now')")
    if result is not None:
        sets.append("result=?"); params.append(json.dumps(result))
    if error is not None:
        sets.append("error=?"); params.append(error)
    params.append(action_id)
    cur = conn.execute(f"UPDATE actions SET {', '.join(sets)} WHERE id=?", params)
    conn.commit()
    return cur.rowcount


def claim_action(conn, action_id) -> bool:
    cur = conn.execute(
        "UPDATE actions SET status='executing', updated_at=datetime('now') "
        "WHERE id=? AND (status='approved' OR (status='drafted' AND mode='auto'))",
        (action_id,))
    conn.commit()
    return cur.rowcount == 1


def has_open_action(conn, entity_type, entity_id, action_type) -> bool:
    row = conn.execute(
        "SELECT 1 FROM actions WHERE entity_type=? AND entity_id=? AND action_type=? "
        "AND (status IN ('drafted','approved','executing') "
        "     OR (status='completed' AND executed_at > datetime('now','-1 day'))) "
        "LIMIT 1", (entity_type, entity_id, action_type)).fetchone()
    return row is not None


# --- guidance primitives ---------------------------------------------------

def add_guidance(conn, scope, text) -> int:
    """Insert a guidance entry. Returns the new id."""
    cur = conn.execute("INSERT INTO guidance (scope, text) VALUES (?, ?)", (scope, text))
    conn.commit()
    return cur.lastrowid


def list_guidance(conn, scope=None) -> list:
    """List guidance entries, newest first. If scope given, matches that scope OR 'global'."""
    if scope is None:
        rows = conn.execute("SELECT * FROM guidance ORDER BY created_at DESC, id DESC")
    else:
        rows = conn.execute(
            "SELECT * FROM guidance WHERE scope=? OR scope='global' "
            "ORDER BY created_at DESC, id DESC", (scope,))
    return [dict(r) for r in rows.fetchall()]


def delete_guidance(conn, guidance_id) -> int:
    """Delete a guidance entry by id. Returns rows affected."""
    cur = conn.execute("DELETE FROM guidance WHERE id=?", (guidance_id,))
    conn.commit()
    return cur.rowcount
