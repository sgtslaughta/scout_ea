"""EA_DB access layer — stdlib sqlite3 only. Shared by web API, MCP, skills."""
from __future__ import annotations
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


# --- data primitives -------------------------------------------------------

_STATUS_TABLES = {"signals", "tasks", "alerts", "events", "learning"}

_SIGNAL_COLS = {"type", "source", "source_skill", "external_ref", "title", "summary",
                "who", "what", "when_rel", "why", "url", "person_id", "topic_id",
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
_REF_LABEL_SQL = {
    "person": "SELECT name AS label FROM people WHERE id=?",
    "task": "SELECT title AS label FROM tasks WHERE id=?",
    "event": "SELECT title AS label FROM events WHERE id=?",
}


def add_deadline_link(conn: sqlite3.Connection, deadline_id: int, ref_type: str, ref_id: int) -> int:
    """Link a deadline to a person/task/event. Idempotent. Returns rowcount."""
    if ref_type not in _REF_LABEL_SQL:
        raise ValueError(f"unknown ref_type: {ref_type!r}")
    cur = conn.execute(
        "INSERT INTO deadline_links (deadline_id, ref_type, ref_id) VALUES (?,?,?) "
        "ON CONFLICT(deadline_id, ref_type, ref_id) DO NOTHING",
        (deadline_id, ref_type, ref_id),
    )
    conn.commit()
    return cur.rowcount


def del_deadline_link(conn: sqlite3.Connection, link_id: int) -> int:
    """Delete a link by its id. Returns rows affected."""
    cur = conn.execute("DELETE FROM deadline_links WHERE id=?", (link_id,))
    conn.commit()
    return cur.rowcount


def list_deadline_links(conn: sqlite3.Connection, deadline_id: int) -> list[dict]:
    """Links for a deadline with resolved labels: [{id, ref_type, ref_id, label}]."""
    rows = conn.execute(
        "SELECT id, ref_type, ref_id FROM deadline_links WHERE deadline_id=? ORDER BY id",
        (deadline_id,),
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        sql = _REF_LABEL_SQL.get(r["ref_type"])
        lbl = conn.execute(sql, (r["ref_id"],)).fetchone() if sql else None
        d["label"] = lbl["label"] if lbl else f'{r["ref_type"]} #{r["ref_id"]}'
        out.append(d)
    return out


def add_deadline_tag(conn: sqlite3.Connection, deadline_id: int, tag: str) -> int:
    """Attach a free-text tag to a deadline. Idempotent. Returns rowcount."""
    tag = tag.strip()
    if not tag:
        raise ValueError("tag cannot be empty")
    cur = conn.execute(
        "INSERT INTO deadline_tags (deadline_id, tag) VALUES (?,?) "
        "ON CONFLICT(deadline_id, tag) DO NOTHING",
        (deadline_id, tag),
    )
    conn.commit()
    return cur.rowcount


def del_deadline_tag(conn: sqlite3.Connection, tag_id: int) -> int:
    """Delete a tag by its id. Returns rows affected."""
    cur = conn.execute("DELETE FROM deadline_tags WHERE id=?", (tag_id,))
    conn.commit()
    return cur.rowcount


def list_deadline_tags(conn: sqlite3.Connection, deadline_id: int) -> list[sqlite3.Row]:
    """Tags for a deadline as [{id, tag}] rows."""
    return conn.execute(
        "SELECT id, tag FROM deadline_tags WHERE deadline_id=? ORDER BY tag",
        (deadline_id,),
    ).fetchall()


# --- config helpers --------------------------------------------------------

# NOTE: WRITABLE_CONFIG is a deliberate security allowlist; only specific config keys
# can be modified by end users. Add new keys here explicitly after schema migration.
WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days"}


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
