# SP2 — Data Feed Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Learning, add a News source, and expose `/api/feed` (overview) + filterable per-category list endpoints so SP3's Data Feed page has a complete backend.

**Architecture:** New thin `news_items` table mirrors `learning`/`trend_finding`. New `ea/db.py` read+write helpers. New `lib/feed.py` holds `overview()` + a shared `filter_ids()` that resolves tag/origin/person filters through the SP1 association layer (`content_ids_by_tag`, `content_links`). Endpoints stay thin. Origin (internal/external) is an SP1 tag, never a column.

**Tech Stack:** stdlib `sqlite3`, FastAPI, FastMCP, React 19 + TS (api.ts only), vitest/pytest.

## Global Constraints

- SQLite (stdlib `sqlite3`) only; migration idempotent via `CREATE … IF NOT EXISTS`.
- All `add_*` column names validated against Python whitelists before SQL (injection guard); `ref_type` args to SP1 helpers are literal constants, never request strings.
- Origin stored ONLY as an SP1 tag (`internal`/`external`), never a column.
- `/api/feed` overview default recent count = 12.
- Reuse SP1 `db.list_tags_for`/`list_links_for`/`content_ids_by_tag` for all enrichment/filtering — no parallel association path.
- Backend tests via `cd backend && ../.venv/bin/pytest` (no bare `pytest` on PATH). Frontend `tsc` via `cd frontend && npx tsc --noEmit`.
- Status changes reuse the EXISTING generic `POST /api/{table}/{row_id}/status` (table must be in `_STATUS_TABLES`) — do NOT add dedicated status endpoints. (Deviation from spec's dedicated endpoints — the generic route already covers both tables; `learning` is already registered, `news_items` gets registered in Task 1.)
- Semantic commits; executes on branch `feat/data-feed-backend`.

---

### Task 1: DB layer — news_items table + learning/news read & write helpers

**Files:**
- Modify: `backend/ea/features.sql` (append migration 007)
- Modify: `backend/ea/db.py` (`_STATUS_TABLES`; new helpers)
- Modify: `backend/mcp_server/tools.py` (`_READABLE` add `news_items`)
- Test: `backend/tests/test_feed_db.py` (create)

**Interfaces:**
- Consumes: SP1 nothing directly here.
- Produces: `list_learning(conn, status=None, topic_id=None) -> list[Row]`, `list_news(conn, status=None, topic_id=None) -> list[Row]`, `add_learning(conn, **fields) -> int`, `add_news_item(conn, **fields) -> int`, `tag_id_by_name(conn, name) -> int | None`, and `_LEARNING_COLS`/`_NEWS_COLS` whitelists. `news_items` in `_STATUS_TABLES` + `_READABLE`.

- [ ] **Step 1: Add the table to `features.sql`** — append:

```sql
-- Feature migration 007: news items (Data Feed)
CREATE TABLE IF NOT EXISTS news_items (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  url          TEXT,
  synopsis     TEXT,
  external_ref TEXT UNIQUE,
  topic_id     INTEGER REFERENCES topics(id),
  source       TEXT,
  source_skill TEXT,
  event_at     TEXT,
  relevance    INTEGER,
  status       TEXT NOT NULL DEFAULT 'new',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_status ON news_items(status, created_at);
CREATE TRIGGER IF NOT EXISTS trg_news_touch AFTER UPDATE ON news_items
BEGIN UPDATE news_items SET updated_at = datetime('now') WHERE id = NEW.id; END;
```

- [ ] **Step 2: Write the failing test** — create `backend/tests/test_feed_db.py`:

```python
import pytest
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_add_and_list_news(tmp_path):
    conn = _conn(tmp_path)
    assert db.add_news_item(conn, title="AI news", url="http://x/1", external_ref="http://x/1",
                            topic_id=1, event_at="2026-07-10T09:00:00", status="new") == 1
    assert db.add_news_item(conn, title="dup", url="http://x/1", external_ref="http://x/1") == 0  # dedup
    rows = db.list_news(conn)
    assert [r["title"] for r in rows] == ["AI news"]
    assert db.list_news(conn, status="archived") == []
    assert [r["title"] for r in db.list_news(conn, topic_id=1)] == ["AI news"]


def test_add_news_requires_external_ref_and_guards_columns(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="external_ref"):
        db.add_news_item(conn, title="x")
    with pytest.raises(ValueError, match="unknown"):
        db.add_news_item(conn, title="x", external_ref="e", bogus_col=1)


def test_add_and_list_learning(tmp_path):
    conn = _conn(tmp_path)
    assert db.add_learning(conn, kind="course", title="K8s 101", external_ref="l1",
                           source="email", topic_id=1, event_at="2026-07-09T00:00:00") == 1
    assert db.add_learning(conn, kind="course", title="dup", external_ref="l1") == 0
    rows = db.list_learning(conn)
    assert [r["title"] for r in rows] == ["K8s 101"]
    with pytest.raises(ValueError):
        db.add_learning(conn, kind="x", title="y", external_ref="l2", nope=1)


def test_news_registered_for_status_updates(tmp_path):
    conn = _conn(tmp_path)
    db.add_news_item(conn, title="n", url="u", external_ref="u")
    nid = db.list_news(conn)[0]["id"]
    assert db.update_status(conn, "news_items", nid, "read") == 1
    assert db.list_news(conn, status="read")[0]["id"] == nid


def test_tag_id_by_name(tmp_path):
    conn = _conn(tmp_path)
    tid = db.get_or_create_tag(conn, "external", "blue")
    assert db.tag_id_by_name(conn, "external") == tid
    assert db.tag_id_by_name(conn, "nope") is None
```

- [ ] **Step 3: Run — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_feed_db.py -q`
Expected: FAIL (`AttributeError: … 'add_news_item'`).

- [ ] **Step 4: Implement** — in `backend/ea/db.py`:

(a) Add `news_items` to the status whitelist. Find `_STATUS_TABLES = {"signals", "tasks", "alerts", "events", "learning"}` and change to:
```python
_STATUS_TABLES = {"signals", "tasks", "alerts", "events", "learning", "news_items"}
```

(b) Add a new section before `# --- config helpers ---` (after the tags section):
```python
# --- data feed: learning + news --------------------------------------------

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
```

(c) In `backend/mcp_server/tools.py`, add `news_items` to `_READABLE`:
```python
_READABLE = {
    "signals", "tasks", "alerts", "events", "learning", "news_items",
    "critical_deadlines", "trends", "trend_findings",
    "people", "topics", "config",
}
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_feed_db.py -q`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/ea/features.sql backend/ea/db.py backend/mcp_server/tools.py backend/tests/test_feed_db.py
git commit -m "feat(feed): news_items table + learning/news db helpers"
```

---

### Task 2: `lib/feed.py` — overview + filter_ids

**Files:**
- Create: `backend/lib/feed.py`
- Test: `backend/tests/test_feed_lib.py` (create)

**Interfaces:**
- Consumes: `db.list_tags_for`, `db.list_links_for`, `db.content_ids_by_tag`, `db.tag_id_by_name` (SP1 + Task 1).
- Produces: `overview(conn) -> dict` (`{counts, recent}`), `filter_ids(conn, ref_type, tag=None, origin=None, person=None) -> set[int] | None`, `RECENT_LIMIT = 12`.

- [ ] **Step 1: Write the failing test** — create `backend/tests/test_feed_lib.py`:

```python
from ea import db
from lib import feed


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_overview_counts_and_recent(tmp_path):
    conn = _conn(tmp_path)
    db.add_news_item(conn, title="N1", url="u1", external_ref="u1", event_at="2026-07-10T00:00:00")
    db.add_learning(conn, kind="course", title="L1", external_ref="l1", event_at="2026-07-11T00:00:00")
    ov = feed.overview(conn)
    assert ov["counts"]["news"] == 1 and ov["counts"]["learning"] == 1
    assert ov["counts"]["topics"] == 1  # seed has 1 active topic
    # recent newest-first: L1 (07-11) before N1 (07-10); each has tags/links keys
    titles = [r["title"] for r in ov["recent"]]
    assert titles[:2] == ["L1", "N1"]
    assert "tags" in ov["recent"][0] and "links" in ov["recent"][0]
    assert ov["recent"][0]["category"] == "learning"


def test_filter_ids_by_tag_origin_person(tmp_path):
    conn = _conn(tmp_path)
    db.add_news_item(conn, title="N1", url="u1", external_ref="u1")
    db.add_news_item(conn, title="N2", url="u2", external_ref="u2")
    ids = [r["id"] for r in db.list_news(conn)]
    a, b = min(ids), max(ids)
    db.tag_content(conn, "news", a, "external")
    db.link_content(conn, "news", a, "person", 1)
    assert feed.filter_ids(conn, "news", tag=None, origin=None, person=None) is None
    assert feed.filter_ids(conn, "news", origin="external") == {a}
    assert feed.filter_ids(conn, "news", person=1) == {a}
    # intersection: tag external AND person 1 both on `a`
    assert feed.filter_ids(conn, "news", origin="external", person=1) == {a}
    # unknown tag name -> empty set (no matches), not None
    assert feed.filter_ids(conn, "news", tag="ghost") == set()
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_feed_lib.py -q`
Expected: FAIL (`ModuleNotFoundError: No module named 'lib.feed'`).

- [ ] **Step 3: Implement** — create `backend/lib/feed.py`:

```python
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
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_feed_lib.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/lib/feed.py backend/tests/test_feed_lib.py
git commit -m "feat(feed): lib/feed overview + filter_ids"
```

---

### Task 3: Endpoints — /api/feed, /api/news, /api/learning, trends filter

**Files:**
- Modify: `backend/web/app.py` (import `feed`; new routes; extend `get_trends`)
- Test: `backend/tests/test_web_feed.py` (create)

**Interfaces:**
- Consumes: `feed.overview`, `feed.filter_ids`, `db.list_news`, `db.list_learning`, `db.list_tags_for`, `db.list_links_for`.
- Produces routes: `GET /api/feed`; `GET /api/news`; `GET /api/learning`; extended `GET /api/trends` (adds `tag`,`origin`). Status changes use the existing generic `POST /api/{table}/{row_id}/status` (news via table `news_items`, learning via `learning`).

- [ ] **Step 1: Write the failing test** — create `backend/tests/test_web_feed.py`:

```python
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.add_news_item(conn, title="N1", url="u1", external_ref="u1", topic_id=1, event_at="2026-07-10T00:00:00")
    db.add_news_item(conn, title="N2", url="u2", external_ref="u2")
    nid = next(r["id"] for r in db.list_news(conn) if r["external_ref"] == "u1")  # N1 (dated, topic 1)
    db.tag_content(conn, "news", nid, "external")
    db.link_content(conn, "news", nid, "person", 1)
    db.add_learning(conn, kind="course", title="L1", external_ref="l1", topic_id=1)
    return TestClient(create_app(p)), nid


def test_feed_overview(tmp_path):
    c, _ = _client(tmp_path)
    ov = c.get("/api/feed").json()
    assert ov["counts"]["news"] == 2 and ov["counts"]["learning"] == 1
    assert isinstance(ov["recent"], list) and "tags" in ov["recent"][0]


def test_news_list_and_filters(tmp_path):
    c, nid = _client(tmp_path)
    alln = c.get("/api/news").json()
    assert len(alln) == 2 and "tags" in alln[0]
    assert [r["id"] for r in c.get("/api/news?origin=external").json()] == [nid]
    assert [r["id"] for r in c.get("/api/news?person=1").json()] == [nid]
    assert [r["id"] for r in c.get("/api/news?topic=1").json()] == [nid]  # only N1 has topic_id=1
    assert c.get("/api/news?tag=ghost").json() == []


def test_learning_list(tmp_path):
    c, _ = _client(tmp_path)
    rows = c.get("/api/learning").json()
    assert [r["title"] for r in rows] == ["L1"] and "links" in rows[0]


def test_news_status_via_generic_endpoint(tmp_path):
    c, nid = _client(tmp_path)
    assert c.post(f"/api/news_items/{nid}/status", json={"status": "read"}).json() == {"updated": 1}
    assert [r["id"] for r in c.get("/api/news?status=read").json()] == [nid]
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_web_feed.py -q`
Expected: FAIL (404 on `/api/feed`).

- [ ] **Step 3: Add the import** — in `backend/web/app.py`, alongside the other `from lib import …` lines near the top:
```python
from lib import feed as _feed
```

- [ ] **Step 4: Add a shared enrichment helper + routes** — inside `create_app`, after the `get_trends` endpoint, add:

```python
    def _filtered_enriched(conn, ref_type, rows, tag, person, origin):
        ids = _feed.filter_ids(conn, ref_type, tag=tag, origin=origin,
                               person=int(person) if person else None)
        out = []
        for r in rows:
            d = dict(r)
            if ids is not None and d["id"] not in ids:
                continue
            d["tags"] = db.list_tags_for(conn, ref_type, d["id"])
            d["links"] = db.list_links_for(conn, ref_type, d["id"])
            out.append(d)
        return out

    @app.get("/api/feed")
    def get_feed(conn=Depends(get_db)):
        return _feed.overview(conn)

    @app.get("/api/news")
    def get_news(status: str | None = None, topic: str | None = None, tag: str | None = None,
                 person: str | None = None, origin: str | None = None, conn=Depends(get_db)):
        rows = db.list_news(conn, status=status, topic_id=int(topic) if topic else None)
        return _filtered_enriched(conn, "news", rows, tag, person, origin)

    @app.get("/api/learning")
    def get_learning(status: str | None = None, topic: str | None = None, tag: str | None = None,
                     person: str | None = None, origin: str | None = None, conn=Depends(get_db)):
        rows = db.list_learning(conn, status=status, topic_id=int(topic) if topic else None)
        return _filtered_enriched(conn, "learning", rows, tag, person, origin)
```

- [ ] **Step 5: Extend `get_trends`** — replace the existing `get_trends` body with the tag/origin-filtered version:

```python
    @app.get("/api/trends")
    def get_trends(window_start: str | None = None, tag: str | None = None,
                   origin: str | None = None, conn=Depends(get_db)):
        w = window_start or db.latest_trend_window(conn)
        if w is None:
            return []
        rows = [dict(r) for r in db.list_trends(conn, w)]
        ids = _feed.filter_ids(conn, "trend", tag=tag, origin=origin)
        if ids is not None:
            rows = [r for r in rows if r["id"] in ids]
        return rows
```

- [ ] **Step 6: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_web_feed.py -q`
Expected: PASS (4 passed).

- [ ] **Step 7: Commit**

```bash
git add backend/web/app.py backend/tests/test_web_feed.py
git commit -m "feat(feed): /api/feed + /api/news + /api/learning + trends tag/origin filter"
```

---

### Task 4: MCP tools — add_learning, add_news

**Files:**
- Modify: `backend/mcp_server/tools.py` (wrappers)
- Modify: `backend/mcp_server/server.py` (`@mcp.tool()` registrations, before `m365_status`)
- Test: `backend/tests/test_mcp_tools.py` (append)

**Interfaces:**
- Consumes: `db.add_learning`, `db.add_news_item`.
- Produces (tools.py): `add_learning(conn, **fields) -> int`, `add_news(conn, **fields) -> int`.

- [ ] **Step 1: Write the failing test** — append to `backend/tests/test_mcp_tools.py`:

```python
def test_add_learning_and_news_tools(tmp_path):
    conn = _conn(tmp_path)
    assert tools.add_learning(conn, kind="course", title="K8s", external_ref="l1", source="email") == 1
    assert tools.add_news(conn, title="AI", external_ref="u1", url="u1", topic_id=1) == 1
    learning = tools.list_table(conn, "learning")
    news = tools.list_table(conn, "news_items")
    assert learning[0]["title"] == "K8s"
    assert news[0]["title"] == "AI"
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_mcp_tools.py::test_add_learning_and_news_tools -q`
Expected: FAIL (`AttributeError: … 'add_learning'`).

- [ ] **Step 3: Implement wrappers** — append to `backend/mcp_server/tools.py`:

```python
def add_learning(conn, **fields) -> int:
    return db.add_learning(conn, **fields)


def add_news(conn, **fields) -> int:
    return db.add_news_item(conn, **fields)
```

- [ ] **Step 4: Register tools** — in `backend/mcp_server/server.py`, immediately before the `m365_status` tool:

```python
    @mcp.tool()
    def add_learning(kind: str, title: str, external_ref: str, source: str = "skill",
                     synopsis: str | None = None, url: str | None = None,
                     provider: str | None = None, event_at: str | None = None,
                     topic_id: int | None = None, relevance: int | None = None,
                     status: str = "suggested", source_skill: str | None = None) -> int:
        """Add a learning/training item, dedup on external_ref. Returns rowcount."""
        conn = _conn()
        try:
            fields = {"kind": kind, "title": title, "external_ref": external_ref, "source": source, "status": status}
            for k, v in (("synopsis", synopsis), ("url", url), ("provider", provider),
                         ("event_at", event_at), ("topic_id", topic_id), ("relevance", relevance),
                         ("source_skill", source_skill)):
                if v is not None:
                    fields[k] = v
            return tools.add_learning(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def add_news(title: str, external_ref: str, url: str | None = None, synopsis: str | None = None,
                 topic_id: int | None = None, source: str = "web", source_skill: str | None = None,
                 event_at: str | None = None, relevance: int | None = None, status: str = "new") -> int:
        """Add a news item, dedup on external_ref (usually the url). Returns rowcount."""
        conn = _conn()
        try:
            fields = {"title": title, "external_ref": external_ref, "source": source, "status": status}
            for k, v in (("url", url), ("synopsis", synopsis), ("topic_id", topic_id),
                         ("source_skill", source_skill), ("event_at", event_at), ("relevance", relevance)):
                if v is not None:
                    fields[k] = v
            return tools.add_news(conn, **fields)
        finally:
            conn.close()
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_mcp_tools.py -q`
Expected: PASS (all, incl. new test).

- [ ] **Step 6: Commit**

```bash
git add backend/mcp_server/tools.py backend/mcp_server/server.py backend/tests/test_mcp_tools.py
git commit -m "feat(feed): MCP tools add_learning/add_news"
```

---

### Task 5: Frontend api.ts — types + fetchers

**Files:**
- Modify: `frontend/src/api.ts`
- Test: none (types + thin fetchers; `tsc` is the gate)

**Interfaces:**
- Consumes: existing `fetchJson`, `postJson`; SP1 `ContentTag`, `ContentLink`.
- Produces: `NewsItem`, `LearningItem`, `FeedRecent`, `FeedOverview`, `FeedFilters`; `getFeed`, `getNews`, `getLearning`, `setNewsStatus`, `setLearningStatus`.

- [ ] **Step 1: Add types** — in `frontend/src/api.ts`, after the `ContentRefs` interface (SP1):

```ts
export interface NewsItem {
  id: number; title: string; url?: string; synopsis?: string; topic_id?: number
  source?: string; event_at?: string; relevance?: number; status: string
  tags?: ContentTag[]; links?: ContentLink[]
}
export interface LearningItem {
  id: number; kind: string; title: string; synopsis?: string; url?: string; provider?: string
  event_at?: string; topic_id?: number; relevance?: number; status: string
  tags?: ContentTag[]; links?: ContentLink[]
}
export interface FeedRecent {
  category: string; id: number; title: string; when: string; url?: string; status: string
  tags?: ContentTag[]; links?: ContentLink[]
}
export interface FeedOverview { counts: Record<string, number>; recent: FeedRecent[] }
export interface FeedFilters { status?: string; topic?: number; tag?: string; person?: number; origin?: string }
```

- [ ] **Step 2: Add fetchers** — after the SP1 tag fetchers:

```ts
const feedQuery = (f?: FeedFilters) => {
  if (!f) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const getFeed = () => fetchJson<FeedOverview>('/api/feed')
export const getNews = (filters?: FeedFilters) => fetchJson<NewsItem[]>(`/api/news${feedQuery(filters)}`)
export const getLearning = (filters?: FeedFilters) => fetchJson<LearningItem[]>(`/api/learning${feedQuery(filters)}`)
export const setNewsStatus = (id: number, status: string) =>
  postJson<{ updated: number }>(`/api/news_items/${id}/status`, { status })
export const setLearningStatus = (id: number, status: string) =>
  postJson<{ updated: number }>(`/api/learning/${id}/status`, { status })
```

- [ ] **Step 3: Verify tsc** — Run: `cd frontend && npx tsc --noEmit`
Expected: clean (no output).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat(feed): FE api types + fetchers for feed/news/learning"
```

---

### Task 6: News populator skill + seed data

**Files:**
- Create: `skills/news_search/SKILL.md`
- Modify: `backend/ea/seed.sql` (demo news + learning + associations)
- Test: `backend/tests/test_seed.py` (verify it still loads + new rows present — adjust existing or add assertion)

**Interfaces:** none (skill prompt is agent-facing; seed is data). The skill calls MCP tools `add_news` (Task 4), `link_content`/`tag_content` (SP1).

- [ ] **Step 1: Create the skill prompt** — create `skills/news_search/SKILL.md`:

```markdown
---
name: news_search
description: Search current headlines per topic; add news_items (deduped), tagged external + linked to topic/people
schedule: automation, daily 06:30 EST
---

## Gather active topics
Query `SELECT * FROM topics WHERE active=1 ORDER BY priority, name`. For each topic:

## Search current headlines
Perform a news/web search for recent articles in the topic area (last 3 days where the
engine supports date filtering). Extract the top results (respect `topics.max_suggest`,
default 5, per topic per run).

For each article, extract: `title`, `url`, `synopsis` (first 2–3 sentences),
`event_at` (publish time if known), `relevance` (1 exact → 5 tangential).

## Deconflict + insert
1. `external_ref` = the article url. Skip if a news item with that url already exists.
2. Call `add_news(title=…, url=…, external_ref=url, synopsis=…, topic_id=<topic id>,
   event_at=…, relevance=…, source="news", source_skill="news_search")`.

## Associate what you create
After inserting each news row (id returned by add_news):
- `link_content("news", <id>, "topic", <topic_id>)`; add `link_content("news", <id>, "person", <person_id>)` for any people the article concerns.
- `tag_content("news", <id>, "external")` (news is external-origin); add 1–2 subject labels (`list_tags()` first, reuse existing).

## Log the run
Call `log_skill_run("news_search", items_created=<n>, status="ok")`.
```

- [ ] **Step 2: Add demo rows to `seed.sql`** — append to `backend/ea/seed.sql`:

```sql
-- Data Feed demo content
INSERT OR IGNORE INTO news_items(id, title, url, synopsis, external_ref, topic_id, source, event_at, relevance, status) VALUES
  (1, 'New agent framework hits 1.0', 'https://example.com/agents-1-0', 'A widely used agent framework shipped its 1.0 with tool-calling improvements.', 'https://example.com/agents-1-0', 1, 'news', '2026-07-10T13:00:00', 1, 'new'),
  (2, 'Internal: Platform team weekly digest', 'https://intranet/acme/digest', 'Roundup of platform chatter across Teams channels this week.', 'https://intranet/acme/digest', 1, 'teams', '2026-07-09T17:00:00', 2, 'new');

INSERT OR IGNORE INTO learning(id, kind, source, title, synopsis, url, external_ref, provider, event_at, topic_id, relevance, status) VALUES
  (1, 'course', 'email', 'Kubernetes for Operators', 'Hands-on operator patterns and CRDs.', 'https://learn.example.com/k8s-ops', 'learn:k8s-ops', 'ExampleLearn', '2026-07-20T15:00:00', 1, 1, 'suggested');

-- origin + subject tags via the universal system
INSERT OR IGNORE INTO tags(id, name, color) VALUES (1, 'external', 'blue'), (2, 'internal', 'violet');
INSERT OR IGNORE INTO content_tags(tag_id, ref_type, ref_id) VALUES (1, 'news', 1), (2, 'news', 2);
INSERT OR IGNORE INTO content_links(ref_type, ref_id, target_type, target_id) VALUES
  ('news', 1, 'topic', 1), ('news', 1, 'person', 1), ('learning', 1, 'topic', 1);
```

- [ ] **Step 3: Verify seed loads + rows present** — check `backend/tests/test_seed.py` exists; add (or create the file with) this test:

```python
from ea import db


def test_seed_includes_feed_demo(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    assert db.list_news(conn) != []
    assert db.list_learning(conn) != []
    # the external tag resolves and is attached to news #1
    tags = db.list_tags_for(conn, "news", 1)
    assert any(t["name"] == "external" for t in tags)
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_seed.py -q`
Expected: PASS.

- [ ] **Step 5: Verify skill block present**

Run: `grep -l "Associate what you create" skills/news_search/SKILL.md`
Expected: prints the path.

- [ ] **Step 6: Commit**

```bash
git add skills/news_search/SKILL.md backend/ea/seed.sql backend/tests/test_seed.py
git commit -m "feat(feed): news_search skill + demo seed data"
```

---

## Self-Review

**Spec coverage:** news_items table (T1) ✓; learning wired up (T1) ✓; add_learning/add_news_item + whitelists (T1) ✓; list helpers with status/topic filter + NULL-ordering (T1) ✓; `news_items` in `_STATUS_TABLES`/`_READABLE` (T1) ✓; `lib/feed.overview` + `filter_ids` (T2) ✓; endpoints /api/feed, /api/news, /api/learning + trends filter (T3) ✓; status via generic endpoint (T3 test proves it) ✓; MCP add_learning/add_news (T4) ✓; FE api types+fetchers (T5) ✓; news_search skill + seed rows (T6) ✓; origin-as-tag used throughout (T2 filter_ids, T6 seed) ✓; RECENT_LIMIT=12 (T2) ✓; test matrix present each task ✓. SP3 correctly out of scope.

**Placeholder scan:** every code step carries full code; no TBD / "handle errors" / vague steps. Clean.

**Type consistency:** `filter_ids(conn, ref_type, tag, origin, person) -> set|None` used identically in T2 (def), T3 (`_filtered_enriched` + trends). `list_news`/`list_learning(conn, status, topic_id)` signature consistent T1→T3. `overview` returns `{counts, recent}` matching FE `FeedOverview` (T5). Recent item shape `{category,id,title,when,url,status,tags,links}` = FE `FeedRecent` (T5). `add_news_item` (db) vs MCP tool name `add_news` (wrapper) — intentional and consistent (tools.py `add_news` → `db.add_news_item`). Status endpoint uses table name `news_items` in both T3 test and T5 `setNewsStatus`. Consistent.
