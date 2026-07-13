"""Agent-facing tool functions over EA_DB — thin wrappers around ea.db. No MCP SDK here."""
from __future__ import annotations
from ea import db
from lib import search as _search

# Tables an agent may read via the generic list tool.
_READABLE = {
    "signals", "tasks", "alerts", "events", "learning", "news_items",
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


def query(conn, table, filters=None, since=None, until=None, order=None, limit=50):
    """Read-only flexible SELECT. See db.query."""
    return db.query(conn, table, filters=filters, since=since, until=until,
                    order=order, limit=limit)


def upsert_trend(conn, term, kind, window_start, window_end, score=0, count=0,
                 delta=None, sources=None, source_skill=None) -> int:
    return db.upsert_trend(conn, term=term, kind=kind, window_start=window_start,
                           window_end=window_end, score=score, count=count,
                           delta=delta, sources=sources, source_skill=source_skill)


def add_trend_finding(conn, **fields) -> int:
    return db.add_trend_finding(conn, **fields)


def tag_content(conn, ref_type, ref_id, tag, color="neutral") -> int:
    return db.tag_content(conn, ref_type, ref_id, tag, color)


def link_content(conn, ref_type, ref_id, target_type, target_id) -> int:
    return db.link_content(conn, ref_type, ref_id, target_type, target_id)


def list_tags(conn):
    return [dict(r) for r in db.list_all_tags(conn)]


def add_learning(conn, **fields) -> int:
    return db.add_learning(conn, **fields)


def add_news(conn, **fields) -> int:
    return db.add_news_item(conn, **fields)


def add_action(conn, **fields) -> int:
    return db.add_action(conn, **fields)


def list_actions(conn, status=None, mode=None):
    return db.list_actions(conn, status=status, mode=mode)


def update_action(conn, action_id, **kw) -> int:
    return db.update_action(conn, action_id, **kw)


def claim_action(conn, action_id) -> bool:
    return db.claim_action(conn, action_id)


def has_open_action(conn, entity_type, entity_id, action_type) -> bool:
    return db.has_open_action(conn, entity_type, entity_id, action_type)


def add_guidance(conn, scope, text) -> int:
    return db.add_guidance(conn, scope, text)


def list_guidance(conn, scope=None):
    return db.list_guidance(conn, scope=scope)


def search(conn, q, limit=20):
    """Full-text search across core entities. See lib.search.search."""
    return _search.search(conn, q, limit=min(int(limit), 50))


def get_entity(conn, ref_type, ref_id):
    """Full context for one entity. See db.get_entity."""
    return db.get_entity(conn, ref_type, ref_id)
