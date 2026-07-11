"""Full-text search over core entities via a rebuilt-on-demand FTS5 index.

The DB is single-user and small, so `search()` rebuilds `search_index` on every
call — always consistent, no triggers, no cross-connection staleness guessing
(PRAGMA data_version is connection-local and doesn't bump for same-connection
writes, so it can't be used here). User text never reaches the FTS MATCH grammar
raw: `_fts_query` keeps only alphanumeric tokens and appends prefix `*`.
"""
from __future__ import annotations
import re

# (kind, INSERT ... SELECT) — title is the display label, body is extra search text.
_SOURCES: list[tuple[str, str]] = [
    ("signal",
     "INSERT INTO search_index(kind, ref_id, title, body) "
     "SELECT 'signal', id, title, "
     "coalesce(summary,'')||' '||coalesce(who,'')||' '||coalesce(what,'')||' '||coalesce(why,'') "
     "FROM signals"),
    ("task",
     "INSERT INTO search_index(kind, ref_id, title, body) "
     "SELECT 'task', id, title, coalesce(detail,'') FROM tasks"),
    ("deadline",
     "INSERT INTO search_index(kind, ref_id, title, body) "
     "SELECT 'deadline', id, title, coalesce(detail,'') FROM critical_deadlines"),
    ("event",
     "INSERT INTO search_index(kind, ref_id, title, body) "
     "SELECT 'event', id, title, coalesce(body,'') FROM events"),
    ("person",
     "INSERT INTO search_index(kind, ref_id, title, body) "
     "SELECT 'person', id, name, "
     "coalesce(role,'')||' '||coalesce(org,'')||' '||coalesce(notes,'') "
     "FROM people WHERE active=1"),
    ("topic",
     "INSERT INTO search_index(kind, ref_id, title, body) "
     "SELECT 'topic', id, name, coalesce(description,'') FROM topics WHERE active=1"),
    ("trend",
     "INSERT INTO search_index(kind, ref_id, title, body) "
     "SELECT 'trend', id, term, '' FROM trends"),
]

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def _fts_query(q: str | None) -> str | None:
    """Sanitize free text into a safe FTS5 prefix query, or None if empty."""
    if not q:
        return None
    tokens = _TOKEN_RE.findall(q)
    if not tokens:
        return None
    return " ".join(f"{t}*" for t in tokens)


def rebuild(conn) -> None:
    """Repopulate search_index from all source tables."""
    conn.execute("DELETE FROM search_index")
    for _kind, sql in _SOURCES:
        conn.execute(sql)
    conn.commit()


def search(conn, q: str | None, limit: int = 30) -> list[dict]:
    """Return ranked matches [{kind, ref_id, title, snippet}]. Empty for blank q."""
    fq = _fts_query(q)
    if fq is None:
        return []
    rebuild(conn)
    rows = conn.execute(
        "SELECT kind, ref_id, title, "
        "snippet(search_index, 3, '[', ']', '…', 8) AS snippet "
        "FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT ?",
        (fq, int(limit)),
    ).fetchall()
    return [dict(r) for r in rows]


# ponytail: runnable self-check — `python -m lib.search` against an in-memory DB.
if __name__ == "__main__":
    import sqlite3
    import pathlib
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    ea = pathlib.Path(__file__).resolve().parent.parent / "ea"
    for f in ("schema.sql", "features.sql"):
        c.executescript((ea / f).read_text())
    c.execute("INSERT INTO tasks(title, detail, priority, status) VALUES('Budget review','Q3 numbers',1,'open')")
    c.execute("INSERT INTO topics(name, description, priority, max_suggest) VALUES('Budgeting','money stuff',1,1)")
    c.commit()
    res = search(c, "budg")
    kinds = {r["kind"] for r in res}
    assert kinds == {"task", "topic"}, res
    assert _fts_query('a "b" c!') == "a* b* c*"
    assert _fts_query("   ") is None
    assert search(c, "") == []
    print("search self-check OK:", [(r["kind"], r["title"]) for r in res])
