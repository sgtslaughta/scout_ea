# MCP Capability Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the external MCP LLM full inward context (flexible query, full-text search, one-call entity context) and full outward reach (field-complete writers, user-facing alerts, skill discoverability), safely.

**Architecture:** Unchanged 3-layer pattern — `@mcp.tool()` closure in `backend/mcp_server/server.py` → wrapper fn in `backend/mcp_server/tools.py` → primitive in `backend/ea/db.py`. New read tools are SELECT-only with identifier whitelists and bound params. Most DB primitives already accept every column; several tasks only widen the MCP wrapper signatures. FTS and tag/link readers already exist and are reused.

**Tech Stack:** Python 3.12, stdlib `sqlite3`, FastMCP (`mcp` SDK), pytest.

## Global Constraints

- Read tools are **SELECT/MATCH only**. Never interpolate user values into SQL — bind as params. Table and column identifiers must be validated against a whitelist (or `PRAGMA table_info`) before use in an f-string.
- `query` LIMIT hard-capped at **200**; `search` LIMIT capped at **50**.
- Preserve existing dedup (`ON CONFLICT(external_ref) DO NOTHING`), triggers, and per-column validation in every writer.
- No new dependencies. Bearer auth + container topology unchanged.
- Tests run from `backend/`: `python -m pytest tests/<file> -v`. Test fixtures build a DB with `db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)` and call `tools.*` directly.
- Verify frontend/back untouched by build: not applicable (backend-only). Full check: `cd backend && python -m pytest tests/ -q`.

---

## File Structure

- `backend/ea/db.py` — add primitives: `query`, `get_entity`, `add_alert`. Reuse existing `search` (in `lib/search.py`), `list_tags_for`, `list_links_for`, `list_actions`.
- `backend/mcp_server/tools.py` — add thin wrappers: `query`, `search`, `get_entity`, `add_alert`, `list_skills`; extend read whitelist `_QUERYABLE`.
- `backend/mcp_server/server.py` — add `@mcp.tool()` closures for the new tools; widen `add_signal`/`add_deadline`/`add_task`/`upsert_trend` signatures; thread `skills_dir` into `build_server`/`http_app`/`_runtime_params`.
- `backend/tests/test_mcp_query.py` — new: query + get_entity + search tool tests.
- `backend/tests/test_mcp_tools.py` — extend: field-complete writers, add_alert, list_skills.
- `backend/tests/test_mcp_server.py` — extend: exposure assertions for new tool names.

---

## Task 1: `db.query` — flexible SELECT primitive

**Files:**
- Modify: `backend/ea/db.py` (add after `update_status`, ~line 168)
- Test: `backend/tests/test_mcp_query.py` (create)

**Interfaces:**
- Produces: `db.query(conn, table, filters=None, since=None, until=None, order=None, limit=50) -> list[dict]`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_mcp_query.py`:

```python
import pytest
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_query_filter_and_limit(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="o", external_ref="m1",
                     title="A", status="new", topic_id=1)
    db.upsert_signal(conn, type="email", source="o", external_ref="m2",
                     title="B", status="dismissed", topic_id=1)
    rows = db.query(conn, "signals", filters={"status": "new"})
    assert [r["external_ref"] for r in rows] == ["m1"]
    assert db.query(conn, "signals", limit=1) and len(db.query(conn, "signals", limit=1)) == 1


def test_query_rejects_unknown_table(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.query(conn, "sqlite_master")


def test_query_rejects_unknown_column(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.query(conn, "signals", filters={"drop_me": 1})


def test_query_op_and_in_and_caps_limit(tmp_path):
    conn = _conn(tmp_path)
    for i in range(3):
        db.upsert_signal(conn, type="email", source="o",
                         external_ref=f"m{i}", title="T", priority=i + 1)
    hi = db.query(conn, "signals", filters={"priority": {"op": ">=", "value": 2}})
    assert {r["external_ref"] for r in hi} == {"m1", "m2"}
    inq = db.query(conn, "signals", filters={"external_ref": {"op": "in", "value": ["m0", "m2"]}})
    assert {r["external_ref"] for r in inq} == {"m0", "m2"}
    assert db.query(conn, "signals", limit=99999)  # must not raise; cap applies internally
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_query.py -v`
Expected: FAIL — `AttributeError: module 'ea.db' has no attribute 'query'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/ea/db.py` after `update_status` (after line 167):

```python
# Tables the read-only query() primitive may SELECT from. Excludes push_subscriptions
# (holds push secrets) and search_index (FTS virtual table).
_QUERYABLE = {
    "signals", "tasks", "alerts", "events", "learning", "news_items",
    "critical_deadlines", "trends", "trend_findings", "people", "person_handles",
    "topics", "config", "actions", "guidance", "content_tags", "content_links",
    "skill_runs", "board_columns",
}
_QUERY_OPS = {"=", "!=", "<", "<=", ">", ">=", "in"}
# Per-table column used for since/until range; default 'created_at'.
_QUERY_DATE_COL = {"skill_runs": "ran_at", "trends": "window_start"}


def query(conn: sqlite3.Connection, table: str, filters: dict | None = None,
          since: str | None = None, until: str | None = None,
          order: str | None = None, limit: int = 50) -> list[dict]:
    """Read-only SELECT over a whitelisted table. Identifiers whitelisted, values bound.

    filters: {col: value} for equality, or {col: {"op": OP, "value": v}} where OP in
    _QUERY_OPS ('in' takes a non-empty list). since/until bound-range a date column.
    order: "col" or "col desc". limit capped at 200. Returns list[dict].
    """
    if table not in _QUERYABLE:
        raise ValueError(f"table not queryable: {table!r}")
    cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    where, params = [], []
    for col, val in (filters or {}).items():
        if col not in cols:
            raise ValueError(f"unknown column {col!r} on {table}")
        if isinstance(val, dict):
            op = val.get("op", "=")
            if op not in _QUERY_OPS:
                raise ValueError(f"unknown op {op!r}")
            v = val.get("value")
            if op == "in":
                if not isinstance(v, (list, tuple)) or not v:
                    raise ValueError("'in' requires a non-empty list")
                where.append(f"{col} IN ({', '.join('?' for _ in v)})")
                params.extend(v)
            else:
                where.append(f"{col} {op} ?")
                params.append(v)
        else:
            where.append(f"{col} = ?")
            params.append(val)
    date_col = _QUERY_DATE_COL.get(table, "created_at")
    if date_col in cols:
        if since is not None:
            where.append(f"{date_col} >= ?"); params.append(since)
        if until is not None:
            where.append(f"{date_col} <= ?"); params.append(until)
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    if order:
        parts = order.split()
        ocol = parts[0]
        if ocol not in cols:
            raise ValueError(f"unknown order column {ocol!r}")
        direction = "DESC" if len(parts) > 1 and parts[1].lower() == "desc" else "ASC"
        order_sql = f"{ocol} {direction}"
    else:
        order_sql = "created_at DESC, id DESC" if "created_at" in cols else "id DESC"
    lim = max(1, min(int(limit), 200))
    sql = f"SELECT * FROM {table}{clause} ORDER BY {order_sql} LIMIT {lim}"
    return [dict(r) for r in conn.execute(sql, params).fetchall()]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mcp_query.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_mcp_query.py
git commit -m "feat(mcp): db.query read-only whitelisted SELECT primitive"
```

---

## Task 2: `query` MCP tool + wrapper

**Files:**
- Modify: `backend/mcp_server/tools.py` (add wrapper)
- Modify: `backend/mcp_server/server.py` (add tool closure)
- Modify: `backend/tests/test_mcp_server.py` (exposure assertion)

**Interfaces:**
- Consumes: `db.query` (Task 1)
- Produces: `tools.query(conn, table, filters=None, since=None, until=None, order=None, limit=50) -> list[dict]`; MCP tool `query`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mcp_query.py`:

```python
from mcp_server import tools as mcp_tools


def test_tools_query_passthrough(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="o", external_ref="m1", title="A")
    rows = mcp_tools.query(conn, "signals", filters={"external_ref": "m1"})
    assert rows[0]["title"] == "A"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_query.py::test_tools_query_passthrough -v`
Expected: FAIL — `AttributeError: module 'mcp_server.tools' has no attribute 'query'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/mcp_server/tools.py` (after `list_table`, ~line 45):

```python
def query(conn, table, filters=None, since=None, until=None, order=None, limit=50):
    """Read-only flexible SELECT. See db.query."""
    return db.query(conn, table, filters=filters, since=since, until=until,
                    order=order, limit=limit)
```

Add the tool closure to `backend/mcp_server/server.py` after the `list_rows` tool (after line 38):

```python
    @mcp.tool()
    def query(table: str, filters: dict | None = None, since: str | None = None,
              until: str | None = None, order: str | None = None,
              limit: int = 50) -> list[dict]:
        """Read-only SELECT over a whitelisted table. filters is {col: value} for
        equality or {col: {"op": OP, "value": v}} with OP in =,!=,<,<=,>,>=,in.
        since/until bound a date column (created_at, or ran_at/window_start).
        order is 'col' or 'col desc'. limit capped at 200. Queryable tables:
        signals, tasks, alerts, events, learning, news_items, critical_deadlines,
        trends, trend_findings, people, person_handles, topics, config, actions,
        guidance, content_tags, content_links, skill_runs, board_columns."""
        conn = _conn()
        try:
            return tools.query(conn, table, filters=filters, since=since,
                               until=until, order=order, limit=limit)
        finally:
            conn.close()
```

Add `"query"` to the exposure assertion in `backend/tests/test_mcp_server.py` (find the `assert {...} <= tool_names` set and add `"query"`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mcp_query.py tests/test_mcp_server.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_server/tools.py backend/mcp_server/server.py backend/tests/
git commit -m "feat(mcp): expose query tool (flexible whitelisted reads)"
```

---

## Task 3: `search` MCP tool (wrap existing FTS)

**Files:**
- Modify: `backend/mcp_server/tools.py`
- Modify: `backend/mcp_server/server.py`
- Modify: `backend/tests/test_mcp_query.py`, `backend/tests/test_mcp_server.py`

**Interfaces:**
- Consumes: `lib.search.search(conn, q, limit) -> list[{kind, ref_id, title, snippet}]` (existing)
- Produces: `tools.search(conn, q, limit=20)`; MCP tool `search`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mcp_query.py`:

```python
def test_tools_search_finds_signal(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="o", external_ref="m1",
                     title="Quarterly budget review")
    hits = mcp_tools.search(conn, "budget")
    assert any(h["kind"] == "signal" and h["title"].startswith("Quarterly") for h in hits)


def test_tools_search_blank_returns_empty(tmp_path):
    conn = _conn(tmp_path)
    assert mcp_tools.search(conn, "   ") == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_query.py::test_tools_search_finds_signal -v`
Expected: FAIL — `AttributeError: module 'mcp_server.tools' has no attribute 'search'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/mcp_server/tools.py` (top import section, after `from ea import db`):

```python
from lib import search as _search
```

Add wrapper:

```python
def search(conn, q, limit=20):
    """Full-text search across core entities. See lib.search.search."""
    return _search.search(conn, q, limit=min(int(limit), 50))
```

Add tool closure to `backend/mcp_server/server.py` after the `query` tool:

```python
    @mcp.tool()
    def search(q: str, limit: int = 20) -> list[dict]:
        """Full-text search across signals, tasks, deadlines, events, people,
        topics, trends. Returns [{kind, ref_id, title, snippet}] ranked by
        relevance. Use get_entity(kind, ref_id) to expand a hit. limit capped 50."""
        conn = _conn()
        try:
            return tools.search(conn, q, limit=limit)
        finally:
            conn.close()
```

Add `"search"` to the exposure set in `backend/tests/test_mcp_server.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mcp_query.py tests/test_mcp_server.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_server/ backend/tests/
git commit -m "feat(mcp): expose search tool over existing FTS index"
```

---

## Task 4: `get_entity` — one-call full context

**Files:**
- Modify: `backend/ea/db.py`
- Modify: `backend/mcp_server/tools.py`, `backend/mcp_server/server.py`
- Modify: `backend/tests/test_mcp_query.py`, `backend/tests/test_mcp_server.py`

**Interfaces:**
- Consumes: existing `list_tags_for`, `list_links_for`, `list_actions`, `_TAGGABLE_TYPES`
- Produces: `db.get_entity(conn, ref_type, ref_id) -> dict | None`; `tools.get_entity`; MCP tool `get_entity`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mcp_query.py`:

```python
def test_get_entity_full_context(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="o", external_ref="m1", title="A")
    db.tag_content(conn, "signal", 1, "urgent", "red")
    db.link_content(conn, "signal", 1, "topic", 1)
    ent = db.get_entity(conn, "signal", 1)
    assert ent["row"]["title"] == "A"
    assert [t["name"] for t in ent["tags"]] == ["urgent"]
    assert ent["links"][0]["target_type"] == "topic"
    assert ent["related_actions"] == []


def test_get_entity_missing_returns_none(tmp_path):
    conn = _conn(tmp_path)
    assert db.get_entity(conn, "signal", 999) is None


def test_get_entity_rejects_bad_type(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.get_entity(conn, "nope", 1)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_query.py::test_get_entity_full_context -v`
Expected: FAIL — `AttributeError: module 'ea.db' has no attribute 'get_entity'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/ea/db.py` after `list_all_tags` (~line 353):

```python
# ref_type -> physical table for get_entity (mirrors _TAGGABLE_TYPES naming).
_ENTITY_TABLE = {
    "signal": "signals", "task": "tasks", "deadline": "critical_deadlines",
    "event": "events", "trend": "trends", "trend_finding": "trend_findings",
    "learning": "learning", "news": "news_items", "person": "people", "topic": "topics",
}


def get_entity(conn: sqlite3.Connection, ref_type: str, ref_id: int) -> dict | None:
    """Full context for one entity: {ref_type, ref_id, row, tags, links,
    related_actions}. Returns None if the row does not exist."""
    if ref_type not in _ENTITY_TABLE:
        raise ValueError(f"unknown ref_type: {ref_type!r}")
    table = _ENTITY_TABLE[ref_type]
    row = conn.execute(f"SELECT * FROM {table} WHERE id=?", (ref_id,)).fetchone()
    if row is None:
        return None
    acts = [a for a in list_actions(conn)
            if a.get("entity_type") == ref_type and a.get("entity_id") == ref_id]
    return {
        "ref_type": ref_type, "ref_id": ref_id, "row": dict(row),
        "tags": list_tags_for(conn, ref_type, ref_id),
        "links": list_links_for(conn, ref_type, ref_id),
        "related_actions": acts,
    }
```

Add to `backend/mcp_server/tools.py`:

```python
def get_entity(conn, ref_type, ref_id):
    """Full context for one entity. See db.get_entity."""
    return db.get_entity(conn, ref_type, ref_id)
```

Add tool closure to `backend/mcp_server/server.py` after the `search` tool:

```python
    @mcp.tool()
    def get_entity(ref_type: str, ref_id: int) -> dict | None:
        """Full context for one entity in a single call: the row plus its tags,
        links (person/topic with resolved labels), and related open/recent actions.
        ref_type in signal|task|deadline|event|trend|trend_finding|learning|news|
        person|topic. Returns null if not found."""
        conn = _conn()
        try:
            return tools.get_entity(conn, ref_type, ref_id)
        finally:
            conn.close()
```

Add `"get_entity"` to the exposure set in `backend/tests/test_mcp_server.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mcp_query.py tests/test_mcp_server.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/mcp_server/ backend/tests/
git commit -m "feat(mcp): get_entity returns row + tags + links + related actions"
```

---

## Task 5: Field-complete `add_signal`

**Files:**
- Modify: `backend/mcp_server/server.py` (widen `add_signal`)
- Modify: `backend/tests/test_mcp_tools.py`

**Interfaces:**
- Consumes: `db.upsert_signal` (already accepts all of `_SIGNAL_COLS`)
- Produces: MCP `add_signal` accepting `who, what, when_rel, why, polarity, impact, person_id, topic_id, url, occurred_at, triage_rank`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mcp_tools.py`:

```python
def test_add_signal_full_fields(tmp_path):
    conn = _conn(tmp_path)
    assert tools.add_signal(
        conn, type="email", source="outlook", external_ref="mX", title="Budget",
        who="CFO", what="approve budget", when_rel="today", why="deadline",
        polarity="risk", impact=88, person_id=1, topic_id=1,
        url="http://x", occurred_at="2026-07-13T09:00:00+00:00", triage_rank=1) == 1
    row = tools.list_table(conn, "signals")[0]
    assert row["who"] == "CFO" and row["impact"] == 88 and row["polarity"] == "risk"
```

Note: `tools.add_signal(conn, **fields)` already passes through to `db.upsert_signal`, so no `tools.py` change is needed — this test should pass at the tools layer already. It exists to lock the contract. The real change is the **MCP closure** signature in `server.py` (verified in Step 3 by inspection + the exposure test).

- [ ] **Step 2: Run test to verify it fails (or passes at tools layer)**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py::test_add_signal_full_fields -v`
Expected: PASS at the tools layer (confirms db accepts all fields). If it FAILS with "unknown signal columns", stop — `_SIGNAL_COLS` is missing a column; reconcile before continuing.

- [ ] **Step 3: Widen the MCP closure**

Replace the `add_signal` tool in `backend/mcp_server/server.py` (lines 16-29) with:

```python
    @mcp.tool()
    def add_signal(type: str, source: str, title: str, external_ref: str,
                   status: str = "new", source_skill: str | None = None,
                   summary: str | None = None, priority: int = 3,
                   reasoning: str | None = None, who: str | None = None,
                   what: str | None = None, when_rel: str | None = None,
                   why: str | None = None, polarity: str | None = None,
                   impact: int | None = None, person_id: int | None = None,
                   topic_id: int | None = None, url: str | None = None,
                   occurred_at: str | None = None,
                   triage_rank: int | None = None) -> int:
        """Add an inbound signal (email/teams/etc), dedup on external_ref. Returns
        rowcount (1 new, 0 duplicate). polarity in risk|opportunity|neutral;
        impact is a 0-100 briefing score; who/what/when_rel/why are the structured
        summary; occurred_at is UTC ISO-8601."""
        conn = _conn()
        try:
            fields = {"type": type, "source": source, "title": title,
                      "external_ref": external_ref, "status": status, "priority": priority}
            for k, v in (("source_skill", source_skill), ("summary", summary),
                         ("reasoning", reasoning), ("who", who), ("what", what),
                         ("when_rel", when_rel), ("why", why), ("polarity", polarity),
                         ("impact", impact), ("person_id", person_id),
                         ("topic_id", topic_id), ("url", url),
                         ("occurred_at", occurred_at), ("triage_rank", triage_rank)):
                if v is not None:
                    fields[k] = v
            return tools.add_signal(conn, **fields)
        finally:
            conn.close()
```

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py tests/test_mcp_server.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_server/server.py backend/tests/test_mcp_tools.py
git commit -m "feat(mcp): add_signal accepts all structured signal fields"
```

---

## Task 6: Field-complete `add_deadline`, `add_task`, `upsert_trend`

**Files:**
- Modify: `backend/mcp_server/server.py`
- Modify: `backend/tests/test_mcp_tools.py`

**Interfaces:**
- Consumes: `db.add_deadline` (`_DEADLINE_COLS` has `person_id, signal_id, visible`), `db.add_task` (`_TASK_COLS` has `person_id, source_signal_id, board_column_id, status`), `db.upsert_trend` (has `sources` param)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mcp_tools.py`:

```python
def test_writers_extra_fields(tmp_path):
    conn = _conn(tmp_path)
    assert tools.add_deadline(conn, title="D", due_at="2099-01-01T00:00:00+00:00",
                              source="manual", external_ref="d1",
                              person_id=1, visible=0) == 1
    d = tools.list_table(conn, "critical_deadlines")[0]
    assert d["visible"] == 0 and d["person_id"] == 1
    tid = tools.add_task(conn, title="T", status="in_progress", person_id=1)
    assert tid >= 1
    rid = tools.upsert_trend(conn, "ai", "topic", "2026-06-14", "2026-06-21",
                             score=2.0, sources="signal:1,signal:2")
    assert rid >= 1
    tr = tools.list_table(conn, "trends")[0]
    assert tr["sources"] == "signal:1,signal:2"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py::test_writers_extra_fields -v`
Expected: PASS at tools layer (db already accepts these). If FAIL with "unknown columns", reconcile the `_*_COLS` set. This test locks the tools-layer contract; the MCP closure widening is verified by inspection in Step 3.

- [ ] **Step 3: Widen the MCP closures in `backend/mcp_server/server.py`**

Replace `add_deadline` (lines 49-60):

```python
    @mcp.tool()
    def add_deadline(title: str, due_at: str, source: str, external_ref: str,
                     detail: str | None = None, priority: int = 2,
                     source_skill: str | None = None, person_id: int | None = None,
                     signal_id: int | None = None, visible: int | None = None) -> int:
        """Add a critical deadline (due_at = UTC ISO-8601), dedup on external_ref.
        visible=0 hides it from the deadline strip. Returns rowcount."""
        conn = _conn()
        try:
            fields = {"title": title, "due_at": due_at, "source": source,
                      "external_ref": external_ref, "priority": priority}
            for k, v in (("detail", detail), ("source_skill", source_skill),
                         ("person_id", person_id), ("signal_id", signal_id),
                         ("visible", visible)):
                if v is not None:
                    fields[k] = v
            return tools.add_deadline(conn, **fields)
        finally:
            conn.close()
```

Replace `add_task` (lines 62-75):

```python
    @mcp.tool()
    def add_task(title: str, priority: int = 3, detail: str | None = None,
                 due_at: str | None = None, status: str | None = None,
                 person_id: int | None = None, source_signal_id: int | None = None,
                 board_column_id: int | None = None) -> int:
        """Add an actionable task. status defaults to the table default ('open').
        source_signal_id links the task to the signal that spawned it. Returns id."""
        conn = _conn()
        try:
            fields = {"title": title, "priority": priority}
            for k, v in (("detail", detail), ("due_at", due_at), ("status", status),
                         ("person_id", person_id), ("source_signal_id", source_signal_id),
                         ("board_column_id", board_column_id)):
                if v is not None:
                    fields[k] = v
            return tools.add_task(conn, **fields)
        finally:
            conn.close()
```

Replace `upsert_trend` (lines 88-97):

```python
    @mcp.tool()
    def upsert_trend(term: str, kind: str, window_start: str, window_end: str,
                     score: float = 0, count: int = 0, delta: str | None = None,
                     sources: str | None = None) -> int:
        """Upsert a trend by (term, window_start). sources is a freeform provenance
        string (e.g. 'signal:1,signal:2'). Returns the trend id."""
        conn = _conn()
        try:
            return tools.upsert_trend(conn, term=term, kind=kind,
                                      window_start=window_start, window_end=window_end,
                                      score=score, count=count, delta=delta, sources=sources)
        finally:
            conn.close()
```

Note: `tools.upsert_trend` already forwards `sources` (its signature includes `sources=None`).

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py tests/test_mcp_server.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_server/server.py backend/tests/test_mcp_tools.py
git commit -m "feat(mcp): field-complete add_deadline/add_task/upsert_trend"
```

---

## Task 7: `add_alert` — outward-to-user notification

**Files:**
- Modify: `backend/ea/db.py`
- Modify: `backend/mcp_server/tools.py`, `backend/mcp_server/server.py`
- Modify: `backend/tests/test_mcp_tools.py`, `backend/tests/test_mcp_server.py`

**Interfaces:**
- Produces: `db.add_alert(conn, **fields) -> int`; `tools.add_alert`; MCP tool `add_alert`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mcp_tools.py`:

```python
def test_add_alert(tmp_path):
    conn = _conn(tmp_path)
    aid = tools.add_alert(conn, severity="critical", title="Deadline in 1h",
                          body="Q3 filing due", url="/deadlines",
                          source_table="critical_deadlines", source_id=1)
    assert aid >= 1
    alerts = tools.list_table(conn, "alerts")
    assert alerts[0]["title"] == "Deadline in 1h" and alerts[0]["severity"] == "critical"


def test_add_alert_rejects_bad_column(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        tools.add_alert(conn, severity="info", title="t", body="b", bogus=1)
```

Ensure `import pytest` is present at the top of `test_mcp_tools.py` (it is).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py::test_add_alert -v`
Expected: FAIL — `AttributeError: module 'mcp_server.tools' has no attribute 'add_alert'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/ea/db.py` after `update_status` (near the other primitives, ~line 168):

```python
_ALERT_COLS = {"severity", "title", "body", "url", "source_table", "source_id", "status"}


def add_alert(conn: sqlite3.Connection, **fields) -> int:
    """Insert an alert (toast/push). Requires severity, title, body. Returns new id.
    Columns validated against _ALERT_COLS."""
    for req in ("severity", "title", "body"):
        if req not in fields:
            raise ValueError(f"add_alert requires {req!r}")
    bad = set(fields) - _ALERT_COLS
    if bad:
        raise ValueError(f"unknown alert columns: {bad}")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO alerts ({cols}) VALUES ({placeholders})", list(fields.values())
    )
    conn.commit()
    return cur.lastrowid
```

Add to `backend/mcp_server/tools.py`:

```python
def add_alert(conn, **fields) -> int:
    return db.add_alert(conn, **fields)
```

Add tool closure to `backend/mcp_server/server.py` after `log_skill_run` (after line 86):

```python
    @mcp.tool()
    def add_alert(severity: str, title: str, body: str, url: str | None = None,
                  source_table: str | None = None, source_id: int | None = None) -> int:
        """Raise a user-facing alert (drives toast + web push). severity in
        info|warning|critical. url is an optional in-app deep link. source_table/
        source_id point back at the originating row. Returns the new alert id."""
        conn = _conn()
        try:
            fields = {"severity": severity, "title": title, "body": body}
            for k, v in (("url", url), ("source_table", source_table),
                         ("source_id", source_id)):
                if v is not None:
                    fields[k] = v
            return tools.add_alert(conn, **fields)
        finally:
            conn.close()
```

Add `"add_alert"` to the exposure set in `backend/tests/test_mcp_server.py`.

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py tests/test_mcp_server.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/mcp_server/ backend/tests/
git commit -m "feat(mcp): add_alert tool — LLM can notify the user"
```

---

## Task 8: `list_skills` — discoverability

**Files:**
- Modify: `backend/mcp_server/tools.py`, `backend/mcp_server/server.py`
- Modify: `backend/tests/test_mcp_tools.py`, `backend/tests/test_mcp_server.py`

**Interfaces:**
- Consumes: `lib.skills.list_skills(skills_dir)`, `lib.skill_health.is_active(schedule, last_run_iso, now)`
- Produces: `tools.list_skills(conn, skills_dir) -> list[dict]`; MCP tool `list_skills`; `build_server(db_path, skills_dir=None)`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mcp_tools.py`:

```python
def test_list_skills_roster_and_health(tmp_path):
    conn = _conn(tmp_path)
    skills_dir = tmp_path / "skills" / "triage_email"
    skills_dir.mkdir(parents=True)
    (skills_dir / "SKILL.md").write_text(
        "---\nname: triage_email\ndescription: triage inbound\n"
        "schedule: heartbeat 30m\n---\nbody\n")
    tools.log_skill_run(conn, "triage_email", items_created=1)  # recent run
    skills = tools.list_skills(conn, tmp_path / "skills")
    s = next(x for x in skills if x["name"] == "triage_email")
    assert s["description"] == "triage inbound"
    assert s["last_run"] is not None
    assert s["active"] is True


def test_list_skills_no_dir(tmp_path):
    conn = _conn(tmp_path)
    assert tools.list_skills(conn, None) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py::test_list_skills_roster_and_health -v`
Expected: FAIL — `AttributeError: module 'mcp_server.tools' has no attribute 'list_skills'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/mcp_server/tools.py` (imports):

```python
from lib import skills as _skills
from lib import skill_health as _skill_health
from datetime import datetime, timezone
```

Add wrapper:

```python
def list_skills(conn, skills_dir) -> list[dict]:
    """Skill roster enriched with last_run + active health. [] if skills_dir falsy."""
    if not skills_dir:
        return []
    skills = _skills.list_skills(skills_dir)
    if not skills:
        return []
    last = {r["skill"]: r["last_run"] for r in conn.execute(
        "SELECT skill, MAX(ran_at) AS last_run FROM skill_runs GROUP BY skill")}
    now = datetime.now(timezone.utc)
    for s in skills:
        lr = last.get(s["name"])
        s["last_run"] = lr
        s["active"] = _skill_health.is_active(s.get("schedule"), lr, now)
    return skills
```

Thread `skills_dir` through `backend/mcp_server/server.py`. Change `build_server` signature (line 9):

```python
def build_server(db_path, skills_dir=None) -> FastMCP:
```

Add tool closure after the `list_guidance` tool (after line 274, before `return mcp`):

```python
    @mcp.tool()
    def list_skills() -> list[dict]:
        """List the automation skills Scout runs: [{name, description, schedule,
        last_run, active}]. active=False means the skill is overdue for its cadence."""
        conn = _conn()
        try:
            return tools.list_skills(conn, skills_dir)
        finally:
            conn.close()
```

Update `http_app` (line 279) and `_runtime_params`/`main` to pass `skills_dir`:

```python
def http_app(db_path, token, skills_dir=None):
    """Return the bearer-gated streamable-http ASGI app for this server."""
    app = build_server(db_path, skills_dir=skills_dir).streamable_http_app()
    app.add_middleware(BearerAuthMiddleware, token=token)
    return app
```

In `_runtime_params` (after the `host` line, before `return`):

```python
    skills_dir = environ.get("SKILLS_DIR", "/app/skills")
    from pathlib import Path as _P
    skills_dir = skills_dir if _P(skills_dir).is_dir() else None
    return db_path, token, port, host, skills_dir
```

Update `main()` to unpack and pass:

```python
def main():  # pragma: no cover - process entry, not unit-tested
    import os
    import uvicorn
    db_path, token, port, host, skills_dir = _runtime_params(os.environ)
    uvicorn.run(http_app(db_path, token, skills_dir=skills_dir), host=host, port=port)
```

Add `"list_skills"` to the exposure set in `backend/tests/test_mcp_server.py`.

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py tests/test_mcp_server.py tests/test_mcp_auth.py -v`
Expected: PASS (auth test included — it may call `_runtime_params`/`http_app`; confirm signature change didn't break it. If it constructs `http_app(db, token)`, the new `skills_dir=None` default keeps it working.)

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_server/ backend/tests/
git commit -m "feat(mcp): list_skills tool exposes roster + cadence health"
```

---

## Task 9: `list_action_types` + docstring polish

**Files:**
- Modify: `backend/mcp_server/tools.py`, `backend/mcp_server/server.py`
- Modify: `backend/tests/test_mcp_tools.py`, `backend/tests/test_mcp_server.py`

**Interfaces:**
- Produces: `tools.ACTION_TYPES` (tuple), `tools.list_action_types()`; MCP tool `list_action_types`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mcp_tools.py`:

```python
def test_list_action_types(tmp_path):
    types = tools.list_action_types()
    assert "email_reply" in types and "calendar_invite" in types and "status_set" in types
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_tools.py::test_list_action_types -v`
Expected: FAIL — `AttributeError: module 'mcp_server.tools' has no attribute 'list_action_types'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/mcp_server/tools.py`:

```python
# The outgoing action types the executor skills (run_comms/run_teams/run_calendar/
# run_cowork) know how to run. Keep in sync with those SKILL.md files.
ACTION_TYPES = (
    "email_reply", "email_forward", "email_new", "teams_dm", "teams_group",
    "teams_post", "calendar_invite", "status_set", "cowork_doc", "cowork_gather",
)


def list_action_types() -> list[str]:
    """The valid action_type values for add_action."""
    return list(ACTION_TYPES)
```

Add tool closure to `backend/mcp_server/server.py` after the `add_action` tool (after line 218):

```python
    @mcp.tool()
    def list_action_types() -> list[str]:
        """Valid action_type values for add_action, e.g. email_reply, teams_dm,
        calendar_invite, status_set, cowork_doc. Call before drafting an action."""
        return tools.list_action_types()
```

Add `"list_action_types"` to the exposure set in `backend/tests/test_mcp_server.py`.

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/ -q`
Expected: PASS (full suite)

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_server/ backend/tests/
git commit -m "feat(mcp): list_action_types tool for self-describing outward actions"
```

---

## Final verification

- [ ] Run the full backend suite: `cd backend && python -m pytest tests/ -q` → all green.
- [ ] Confirm tool count: `grep -c '@mcp.tool()' backend/mcp_server/server.py` → 29.
- [ ] Update `skills/README.md`: document the 6 undocumented skills (`news_search`, `run_calendar`, `run_comms`, `run_cowork`, `run_teams`, `scout_actions`) and add the new MCP tools to the reference. (Docs-only; fold into the last commit or a `docs(skills)` commit.)

---

## Self-Review

**Spec coverage:**
- Inward: `query` (T1–2), `search` (T3), `get_entity` (T4), read whitelist incl. `person_handles`/`actions`/`guidance`/`content_*` (T1 `_QUERYABLE`). ✓
- Outward: field-complete `add_signal` (T5), `add_deadline`/`add_task`/`upsert_trend` (T6), `add_alert` (T7). ✓ `update_status` widening — dropped: `db._STATUS_TABLES` already includes `news_items`; `critical_deadlines` uses `update_deadline`/`set_deadline_visible`. Noted here so the omission is intentional, not a gap.
- Cross-cutting: SELECT-only safety with whitelists + bound params + capped LIMIT (T1); `list_skills` (T8); `list_action_types` + docstring enums (T9); tests per tool. ✓
- Docs drift (README 11 vs 17): Final verification step. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `db.query`/`tools.query`/tool `query` share the same signature. `get_entity` returns `{ref_type, ref_id, row, tags, links, related_actions}` consistently across T4 test + impl + tool. `is_active(schedule, last_run_iso, now)` matches the real signature. `build_server(db_path, skills_dir=None)` threaded through `http_app`/`_runtime_params`/`main`. ✓

**Note for implementer:** Tasks 5 and 6 are the exception to strict red-green — their DB layer already accepts the fields, so the tools-layer test passes immediately; the real deliverable is the widened MCP closure signature, confirmed by inspection + the exposure test. This is called out in each task's Step 2.
