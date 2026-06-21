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


def upsert_signal(conn, **fields) -> int:
    """Insert a signal, deduping on external_ref. Returns rowcount (1 new, 0 dup).

    Requires 'external_ref' in fields — dedup engages on it. Raises ValueError if absent.
    """
    if "external_ref" not in fields:
        raise ValueError("upsert_signal requires 'external_ref' in fields")
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
