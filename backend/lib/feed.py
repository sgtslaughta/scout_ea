"""Data Feed aggregation over EA_DB — overview + shared filter resolution."""
from __future__ import annotations
import sqlite3
from ea import db

RECENT_LIMIT = 12
# (category, table, ref_type). trend_findings has no status/event_at columns.
_SOURCES = (
    ("news", "news_items", "news"),
    ("learning", "learning", "learning"),
    ("trending", "trend_findings", "trend_finding"),
)


def _recent_rows(conn: sqlite3.Connection) -> list[tuple[str, str, dict]]:
    items: list[tuple[str, str, dict]] = []
    for category, table, ref_type in _SOURCES:
        if table == "trend_findings":
            sql = ("SELECT id, title, url, '' AS status, created_at AS when_ts "
                   "FROM trend_findings ORDER BY created_at DESC, id DESC LIMIT ?")
        else:
            sql = (f"SELECT id, title, url, status, COALESCE(event_at, created_at) AS when_ts "
                   f"FROM {table} ORDER BY when_ts DESC, id DESC LIMIT ?")
        for r in conn.execute(sql, (RECENT_LIMIT,)):
            items.append((category, ref_type, dict(r)))
    return items


def overview(conn: sqlite3.Connection) -> dict:
    """{'counts': {trending,news,learning,topics}, 'recent': [ …enriched… ]}."""
    counts = {
        "trending": conn.execute("SELECT COUNT(*) c FROM trends").fetchone()["c"],
        "news": conn.execute("SELECT COUNT(*) c FROM news_items WHERE status!='archived'").fetchone()["c"],
        "learning": conn.execute("SELECT COUNT(*) c FROM learning WHERE status!='dismissed'").fetchone()["c"],
        "topics": conn.execute("SELECT COUNT(*) c FROM topics WHERE active=1").fetchone()["c"],
    }
    rows = _recent_rows(conn)
    rows.sort(key=lambda t: t[2]["when_ts"] or "", reverse=True)
    recent = []
    for category, ref_type, r in rows[:RECENT_LIMIT]:
        recent.append({
            "category": category, "id": r["id"], "title": r["title"],
            "when": r["when_ts"], "url": r.get("url"), "status": r["status"],
            "tags": db.list_tags_for(conn, ref_type, r["id"]),
            "links": db.list_links_for(conn, ref_type, r["id"]),
        })
    return {"counts": counts, "recent": recent}


def filter_ids(conn: sqlite3.Connection, ref_type: str,
               tag: str | None = None, origin: str | None = None,
               person: int | None = None) -> set[int] | None:
    """Set of ref_ids matching the given filters (intersection), or None when no
    filter is supplied. Unknown tag/origin name -> empty set (no matches)."""
    sets: list[set[int]] = []
    for name in (tag, origin):
        if name:
            tid = db.tag_id_by_name(conn, name)
            if tid is None:
                return set()
            sets.append({d["ref_id"] for d in db.content_ids_by_tag(conn, tid, ref_type)})
    if person is not None:
        rows = conn.execute(
            "SELECT ref_id FROM content_links WHERE ref_type=? AND target_type='person' AND target_id=?",
            (ref_type, person),
        ).fetchall()
        sets.append({r["ref_id"] for r in rows})
    if not sets:
        return None
    result = sets[0]
    for s in sets[1:]:
        result &= s
    return result
