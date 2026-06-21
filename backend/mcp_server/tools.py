"""Agent-facing tool functions over EA_DB — thin wrappers around ea.db. No MCP SDK here."""
from __future__ import annotations
from ea import db

# Tables an agent may read via the generic list tool.
_READABLE = {
    "signals", "tasks", "alerts", "events", "learning",
    "critical_deadlines", "trends", "trend_findings",
    "people", "topics", "config",
}


def add_signal(conn, **fields) -> int:
    return db.upsert_signal(conn, **fields)


def add_deadline(conn, **fields) -> int:
    return db.add_deadline(conn, **fields)


def add_task(conn, **fields) -> int:
    return db.add_task(conn, **fields)


def update_status(conn, table, row_id, status) -> int:
    return db.update_status(conn, table, row_id, status)


def log_skill_run(conn, skill, **kw) -> int:
    return db.add_skill_run(conn, skill, **kw)


def list_table(conn, table, status=None):
    """Read rows from a whitelisted table (optionally filtered by status). Newest first."""
    if table not in _READABLE:
        raise ValueError(f"table not readable: {table}")
    has_status = status is not None and table in {
        "signals", "tasks", "alerts", "events", "learning", "critical_deadlines",
    }
    order = "created_at DESC, id DESC" if table != "config" else "key"
    if has_status:
        sql = f"SELECT * FROM {table} WHERE status=? ORDER BY {order}"
        return [dict(r) for r in conn.execute(sql, (status,)).fetchall()]
    sql = f"SELECT * FROM {table} ORDER BY {order}"
    return [dict(r) for r in conn.execute(sql).fetchall()]
