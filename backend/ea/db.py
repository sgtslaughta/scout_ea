"""EA_DB access layer — stdlib sqlite3 only. Shared by web API, MCP, skills."""
from __future__ import annotations
import sqlite3
from pathlib import Path

DEFAULT_SCHEMA = Path(__file__).with_name("schema.sql")
DEFAULT_SEED = Path(__file__).with_name("seed.sql")
DEFAULT_FEATURES = Path(__file__).with_name("features.sql")


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
    conn.executescript(Path(DEFAULT_FEATURES).read_text())
    if seed_path is not None:
        conn.executescript(Path(seed_path).read_text())
    conn.commit()
    return conn


# --- data primitives -------------------------------------------------------

_STATUS_TABLES = {"signals", "tasks", "alerts", "events", "learning"}

_SIGNAL_COLS = {"type", "source", "source_skill", "external_ref", "title", "summary",
                "who", "what", "when_rel", "why", "url", "person_id", "topic_id",
                "priority", "triage_rank", "status", "occurred_at"}


def upsert_signal(conn, **fields) -> int:
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


def list_signals(conn, status=None):
    """Return signal rows, newest by created_at DESC then id DESC (tie-break)."""
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


# --- deadline helpers ------------------------------------------------------

_DEADLINE_COLS = {"title", "detail", "due_at", "source", "source_skill", "external_ref",
                  "person_id", "signal_id", "priority", "visible", "status"}


def add_deadline(conn, **fields) -> int:
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


def list_deadlines(conn, respect_global=True):
    """Active, visible deadlines ordered by due_at asc.

    Returns [] when respect_global and config.deadlines_visible_global != '1'.
    """
    if respect_global:
        row = conn.execute(
            "SELECT value FROM config WHERE key='deadlines_visible_global'"
        ).fetchone()
        if row is None or row["value"] != "1":
            return []
    return conn.execute(
        "SELECT * FROM critical_deadlines "
        "WHERE status='active' AND visible=1 ORDER BY due_at ASC"
    ).fetchall()


def set_deadline_visible(conn, deadline_id, visible) -> int:
    """Set per-row visibility (1/0). Returns rows affected."""
    cur = conn.execute(
        "UPDATE critical_deadlines SET visible=? WHERE id=?",
        (1 if visible else 0, deadline_id),
    )
    conn.commit()
    return cur.rowcount


# --- config helpers --------------------------------------------------------

WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days"}


def set_config(conn, key, value) -> None:
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

def upsert_trend(conn, term, kind, window_start, window_end,
                 score=0, count=0, delta=None, sources=None, source_skill=None) -> int:
    """Upsert a trend on (term, window_start). Returns the row id."""
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


def list_trends(conn, window_start):
    """Trends for a window, highest score first."""
    return conn.execute(
        "SELECT * FROM trends WHERE window_start=? ORDER BY score DESC, term ASC",
        (window_start,),
    ).fetchall()


def latest_trend_window(conn):
    """Return the most recent window_start present in trends, or None."""
    row = conn.execute("SELECT MAX(window_start) AS w FROM trends").fetchone()
    return row["w"] if row and row["w"] is not None else None


_TASK_COLS = {"title", "detail", "due_at", "priority", "status",
              "person_id", "source_signal_id"}


def add_task(conn, **fields) -> int:
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


def add_skill_run(conn, skill, window_start=None, window_end=None,
                  items_created=0, status="ok", note=None) -> int:
    """Record a skill run in skill_runs (audit + lookback anchor). Returns the new id."""
    cur = conn.execute(
        "INSERT INTO skill_runs (skill, window_start, window_end, items_created, status, note) "
        "VALUES (?,?,?,?,?,?)",
        (skill, window_start, window_end, items_created, status, note),
    )
    conn.commit()
    return cur.lastrowid
