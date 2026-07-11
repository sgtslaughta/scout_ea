# SP1 — Universal Tags & Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One app-wide association layer — colored label **tags** + typed **entity links** (content→person/topic) — usable from web, MCP, and skills; deadlines folded in so there is exactly one system.

**Architecture:** Three SQLite tables (`tags`, `content_tags`, `content_links`) with Python-whitelisted polymorphic `ref_type`/`target_type` (injection guard). Thin `ea.db` helpers reused by FastAPI endpoints, MCP tools, and skills. Frontend gets theme-aware `tagColors` + reusable `TagChips`/`TagEditor`, replacing the deadline-specific refs UI.

**Tech Stack:** stdlib `sqlite3`, FastAPI + Pydantic, FastMCP, React 19 + TS + MUI v7 + MUI X DataGrid, TanStack Query, vitest.

## Global Constraints

- SQLite (stdlib `sqlite3`) only; migrations idempotent via `CREATE … IF NOT EXISTS` + guarded `_migrate`; `ALTER TABLE` has no `IF NOT EXISTS`.
- Every polymorphic `ref_type`/`target_type` validated against a Python whitelist before any SQL — no agent/user string reaches an interpolated identifier.
- Tag `color` stored as a palette **key** (`neutral|red|amber|green|teal|blue|violet|pink`), never resolved hex.
- MUI v7: `sx` only, no system props. Chips theme-aware (light+dark, all 5 themes) via palette key → CSS var.
- Backend `python -m pytest -q` green; frontend `tsc -b`/`vitest run`/`npm run build` green before each commit.
- Run backend tests via the repo venv: `cd backend && ../.venv/bin/pytest`. Frontend from `cd frontend`.
- Semantic commits; this plan executes on a branch `feat/tags-foundation`.

---

### Task 1: Schema + tag helpers

**Files:**
- Modify: `backend/ea/features.sql` (append migration 006 — the 3 tables)
- Modify: `backend/ea/db.py` (new "universal tags & links" section, tag helpers)
- Test: `backend/tests/test_tags_db.py` (create)

**Interfaces:**
- Produces: `_TAGGABLE_TYPES: set[str]`, `_LINK_TARGET_SQL: dict[str,str]`, `get_or_create_tag(conn, name, color='neutral') -> int`, `tag_content(conn, ref_type, ref_id, name, color='neutral') -> int`, `untag_content(conn, ref_type, ref_id, tag_id) -> int`, `list_tags_for(conn, ref_type, ref_id) -> list[dict]` (`[{tag_id,name,color}]`), `list_all_tags(conn) -> list[Row]`, `content_ids_by_tag(conn, tag_id, ref_type=None) -> list[dict]`.

- [ ] **Step 1: Add the three tables to `features.sql`**

Append at the end of `backend/ea/features.sql`:

```sql
-- Feature migration 006: universal tags + entity links
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT 'neutral',   -- palette key, not hex
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  ref_type   TEXT NOT NULL,
  ref_id     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tag_id, ref_type, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_content_tags_ref ON content_tags(ref_type, ref_id);

CREATE TABLE IF NOT EXISTS content_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_type    TEXT NOT NULL, ref_id    INTEGER NOT NULL,
  target_type TEXT NOT NULL, target_id INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ref_type, ref_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_content_links_ref ON content_links(ref_type, ref_id);
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_tags_db.py`:

```python
import pytest
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_get_or_create_tag_dedupes(tmp_path):
    conn = _conn(tmp_path)
    a = db.get_or_create_tag(conn, "security", "red")
    b = db.get_or_create_tag(conn, "security")
    assert a == b
    assert conn.execute("SELECT COUNT(*) FROM tags").fetchone()[0] == 1


def test_tag_content_idempotent_and_lists(tmp_path):
    conn = _conn(tmp_path)
    assert db.tag_content(conn, "task", 5, "urgent", "amber") == 1
    assert db.tag_content(conn, "task", 5, "urgent") == 0  # dup
    rows = db.list_tags_for(conn, "task", 5)
    assert len(rows) == 1 and rows[0]["name"] == "urgent" and rows[0]["color"] == "amber"
    assert "tag_id" in rows[0]


def test_tag_content_rejects_bad_ref_type(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="ref_type"):
        db.tag_content(conn, "wormhole", 1, "x")


def test_untag_and_content_ids_by_tag(tmp_path):
    conn = _conn(tmp_path)
    db.tag_content(conn, "task", 5, "urgent")
    db.tag_content(conn, "signal", 9, "urgent")
    tid = db.list_tags_for(conn, "task", 5)[0]["tag_id"]
    assert {(r["ref_type"], r["ref_id"]) for r in db.content_ids_by_tag(conn, tid)} == {("task", 5), ("signal", 9)}
    assert db.content_ids_by_tag(conn, tid, ref_type="task") == [{"ref_type": "task", "ref_id": 5}]
    assert db.untag_content(conn, "task", 5, tid) == 1
    assert db.list_tags_for(conn, "task", 5) == []


def test_empty_tag_name_rejected(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.get_or_create_tag(conn, "   ")
```

- [ ] **Step 3: Run it — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_tags_db.py -q`
Expected: FAIL (`AttributeError: module 'ea.db' has no attribute 'get_or_create_tag'`).

- [ ] **Step 4: Implement the helpers**

In `backend/ea/db.py`, add a new section immediately before `# --- config helpers ---`:

```python
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
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_tags_db.py -q`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/ea/features.sql backend/ea/db.py backend/tests/test_tags_db.py
git commit -m "feat(tags): schema + tag helpers (universal tagging foundation)"
```

---

### Task 2: Entity-link helpers

**Files:**
- Modify: `backend/ea/db.py` (add link helpers in the same section)
- Test: `backend/tests/test_tags_db.py` (append)

**Interfaces:**
- Consumes: `_check_ref_type`, `_LINK_TARGET_SQL` (Task 1).
- Produces: `link_content(conn, ref_type, ref_id, target_type, target_id) -> int`, `unlink_content(conn, link_id) -> int`, `list_links_for(conn, ref_type, ref_id) -> list[dict]` (`[{id,target_type,target_id,label}]`).

- [ ] **Step 1: Write the failing test** — append to `backend/tests/test_tags_db.py`:

```python
def test_link_content_resolves_label_and_dedups(tmp_path):
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO people (name) VALUES ('Ada')")
    conn.execute("INSERT INTO topics (name) VALUES ('Kubernetes')")
    conn.commit()
    pid = conn.execute("SELECT id FROM people WHERE name='Ada'").fetchone()["id"]
    tid = conn.execute("SELECT id FROM topics WHERE name='Kubernetes'").fetchone()["id"]
    assert db.link_content(conn, "news", 3, "person", pid) == 1
    assert db.link_content(conn, "news", 3, "person", pid) == 0  # dup
    db.link_content(conn, "news", 3, "topic", tid)
    links = db.list_links_for(conn, "news", 3)
    labels = {(l["target_type"], l["label"]) for l in links}
    assert labels == {("person", "Ada"), ("topic", "Kubernetes")}
    assert db.unlink_content(conn, links[0]["id"]) == 1


def test_link_content_rejects_bad_target_type(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="target_type"):
        db.link_content(conn, "news", 1, "banana", 1)


def test_list_links_unknown_target_falls_back(tmp_path):
    conn = _conn(tmp_path)
    # insert a link with an unresolvable target_type directly (migration can do this)
    conn.execute("INSERT INTO content_links (ref_type, ref_id, target_type, target_id) VALUES ('deadline', 1, 'task', 7)")
    conn.commit()
    links = db.list_links_for(conn, "deadline", 1)
    assert links[0]["label"] == "task #7"
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_tags_db.py -q`
Expected: FAIL (`AttributeError: … 'link_content'`).

- [ ] **Step 3: Implement** — append to the tags section in `backend/ea/db.py`:

```python
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
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_tags_db.py -q`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_tags_db.py
git commit -m "feat(tags): entity-link helpers with label resolution"
```

---

### Task 3: Web endpoints

**Files:**
- Modify: `backend/web/app.py` (Pydantic models near `ConfigBody`; routes near the deadline endpoints)
- Test: `backend/tests/test_web_tags.py` (create)

**Interfaces:**
- Consumes: all Task 1 + Task 2 db helpers.
- Produces routes: `GET/POST /api/tags`; `POST/DELETE /api/content/{ref_type}/{ref_id}/tags[/{tag_id}]`; `POST/DELETE /api/content/{ref_type}/{ref_id}/links[/{link_id}]`; `GET /api/content/{ref_type}/{ref_id}/refs` → `{tags:[…], links:[…]}`.

- [ ] **Step 1: Write the failing test** — create `backend/tests/test_web_tags.py`:

```python
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn.execute("INSERT INTO people (name) VALUES ('Ada')")
    conn.commit()
    return TestClient(create_app(p))


def test_tag_and_link_roundtrip(tmp_path):
    c = _client(tmp_path)
    assert c.post("/api/content/task/1/tags", json={"name": "urgent", "color": "amber"}).json() == {"ok": True}
    assert c.post("/api/content/task/1/links", json={"target_type": "person", "target_id": 1}).json() == {"ok": True}
    refs = c.get("/api/content/task/1/refs").json()
    assert refs["tags"][0]["name"] == "urgent" and refs["tags"][0]["color"] == "amber"
    assert refs["links"][0]["label"] == "Ada"
    # tag appears in the global list
    assert any(t["name"] == "urgent" for t in c.get("/api/tags").json())
    # delete tag + link
    tag_id = refs["tags"][0]["tag_id"]
    link_id = refs["links"][0]["id"]
    assert c.delete(f"/api/content/task/1/tags/{tag_id}").json() == {"deleted": 1}
    assert c.delete(f"/api/content/task/1/links/{link_id}").json() == {"deleted": 1}
    refs2 = c.get("/api/content/task/1/refs").json()
    assert refs2 == {"tags": [], "links": []}


def test_bad_ref_type_400(tmp_path):
    c = _client(tmp_path)
    assert c.post("/api/content/wormhole/1/tags", json={"name": "x"}).status_code == 400


def test_missing_delete_404(tmp_path):
    c = _client(tmp_path)
    assert c.delete("/api/content/task/1/links/999").status_code == 404
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_web_tags.py -q`
Expected: FAIL (404s — routes not registered).

- [ ] **Step 3: Add Pydantic models** — in `backend/web/app.py`, immediately before `class ConfigBody(BaseModel):`:

```python
class TagCreate(BaseModel):
    name: str
    color: str = "neutral"


class ContentTagBody(BaseModel):
    name: str
    color: str = "neutral"


class ContentLinkBody(BaseModel):
    target_type: str
    target_id: int
```

- [ ] **Step 4: Add routes** — in `create_app`, immediately after the `set_visible` deadline endpoint:

```python
    @app.get("/api/tags")
    def get_tags(conn=Depends(get_db)):
        return [dict(r) for r in db.list_all_tags(conn)]

    @app.post("/api/tags")
    def create_tag(body: TagCreate, conn=Depends(get_db)):
        return {"id": db.get_or_create_tag(conn, body.name, body.color)}

    @app.post("/api/content/{ref_type}/{ref_id}/tags")
    def add_content_tag(ref_type: str, ref_id: int, body: ContentTagBody, conn=Depends(get_db)):
        try:
            db.tag_content(conn, ref_type, ref_id, body.name, body.color)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"ok": True}

    @app.delete("/api/content/{ref_type}/{ref_id}/tags/{tag_id}")
    def del_content_tag(ref_type: str, ref_id: int, tag_id: int, conn=Depends(get_db)):
        try:
            n = db.untag_content(conn, ref_type, ref_id, tag_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        if n == 0:
            raise HTTPException(status_code=404, detail="tag not attached")
        return {"deleted": n}

    @app.post("/api/content/{ref_type}/{ref_id}/links")
    def add_content_link(ref_type: str, ref_id: int, body: ContentLinkBody, conn=Depends(get_db)):
        try:
            db.link_content(conn, ref_type, ref_id, body.target_type, body.target_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"ok": True}

    @app.delete("/api/content/{ref_type}/{ref_id}/links/{link_id}")
    def del_content_link(ref_type: str, ref_id: int, link_id: int, conn=Depends(get_db)):
        if db.unlink_content(conn, link_id) == 0:
            raise HTTPException(status_code=404, detail="link not found")
        return {"deleted": 1}

    @app.get("/api/content/{ref_type}/{ref_id}/refs")
    def get_content_refs(ref_type: str, ref_id: int, conn=Depends(get_db)):
        try:
            return {"tags": db.list_tags_for(conn, ref_type, ref_id),
                    "links": db.list_links_for(conn, ref_type, ref_id)}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_web_tags.py -q`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/web/app.py backend/tests/test_web_tags.py
git commit -m "feat(tags): web endpoints for tags + content links"
```

---

### Task 4: MCP tools

**Files:**
- Modify: `backend/mcp_server/tools.py` (wrappers)
- Modify: `backend/mcp_server/server.py` (`@mcp.tool()` registrations, before `m365_status`)
- Test: `backend/tests/test_mcp_tools.py` (append)

**Interfaces:**
- Consumes: `db.tag_content`, `db.link_content`, `db.list_all_tags`.
- Produces (tools.py): `tag_content(conn, ref_type, ref_id, tag, color='neutral') -> int`, `link_content(conn, ref_type, ref_id, target_type, target_id) -> int`, `list_tags(conn) -> list[dict]`.

- [ ] **Step 1: Write the failing test** — append to `backend/tests/test_mcp_tools.py`:

```python
def test_tag_and_link_tools(tmp_path):
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO people (name) VALUES ('Ada')")
    conn.commit()
    assert tools.tag_content(conn, "task", 1, "urgent", "amber") == 1
    assert tools.link_content(conn, "task", 1, "person", 1) == 1
    names = {t["name"] for t in tools.list_tags(conn)}
    assert "urgent" in names
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_mcp_tools.py::test_tag_and_link_tools -q`
Expected: FAIL (`AttributeError: … 'tag_content'`).

- [ ] **Step 3: Implement wrappers** — append to `backend/mcp_server/tools.py`:

```python
def tag_content(conn, ref_type, ref_id, tag, color="neutral") -> int:
    return db.tag_content(conn, ref_type, ref_id, tag, color)


def link_content(conn, ref_type, ref_id, target_type, target_id) -> int:
    return db.link_content(conn, ref_type, ref_id, target_type, target_id)


def list_tags(conn):
    return [dict(r) for r in db.list_all_tags(conn)]
```

- [ ] **Step 4: Register tools** — in `backend/mcp_server/server.py`, immediately before the `m365_status` tool:

```python
    @mcp.tool()
    def tag_content(ref_type: str, ref_id: int, tag: str, color: str = "neutral") -> int:
        """Attach a label tag to a content row. ref_type in deadline|task|signal|event|trend|
        trend_finding|learning|news|person|topic. color is a palette key. Returns rowcount."""
        conn = _conn()
        try:
            return tools.tag_content(conn, ref_type, ref_id, tag, color)
        finally:
            conn.close()

    @mcp.tool()
    def link_content(ref_type: str, ref_id: int, target_type: str, target_id: int) -> int:
        """Link a content row to a person or topic (target_type in person|topic). Returns rowcount."""
        conn = _conn()
        try:
            return tools.link_content(conn, ref_type, ref_id, target_type, target_id)
        finally:
            conn.close()

    @mcp.tool()
    def list_tags() -> list[dict]:
        """List all known tags [{id,name,color}]. Call before inventing a new tag name."""
        conn = _conn()
        try:
            return tools.list_tags(conn)
        finally:
            conn.close()
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_mcp_tools.py -q`
Expected: PASS (all, incl. new test).

- [ ] **Step 6: Commit**

```bash
git add backend/mcp_server/tools.py backend/mcp_server/server.py backend/tests/test_mcp_tools.py
git commit -m "feat(tags): MCP tools tag_content/link_content/list_tags"
```

---

### Task 5: Frontend primitives (`tagColors`, api, `TagChips`, `TagEditor`)

**Files:**
- Create: `frontend/src/lib/tagColors.ts`
- Modify: `frontend/src/api.ts` (types + fetchers)
- Create: `frontend/src/components/TagChips.tsx`
- Create: `frontend/src/components/TagEditor.tsx`
- Test: `frontend/src/components/TagChips.test.tsx` (create)

**Interfaces:**
- Consumes: Task 3 endpoints.
- Produces (api.ts): `Tag{id,name,color}`, `ContentTag{tag_id,name,color}`, `ContentLink{id,target_type,target_id,label}`, `ContentRefs{tags,links}`, and fetchers `getTags`, `createTag`, `getContentRefs`, `tagContent`, `untagContent`, `linkContent`, `unlinkContent`.
- Produces (components): `<TagChips tags? links? onTagClick? onLinkClick? />`, `<TagEditor refType refId />`.
- Produces (tagColors): `colorOf(key) -> {bg,fg}`, `COLOR_KEYS: TagColorKey[]`.

- [ ] **Step 1: Add `tagColors.ts`** — create `frontend/src/lib/tagColors.ts`:

```ts
// Tag palette keys → theme-driven CSS var swatches. Stored keys stay theme-independent;
// the vars (pushed by ThemeSelectionProvider) resolve per active theme + mode.
export type TagColorKey = 'neutral' | 'red' | 'amber' | 'green' | 'teal' | 'blue' | 'violet' | 'pink'
interface Swatch { bg: string; fg: string }

export const TAG_COLORS: Record<TagColorKey, Swatch> = {
  neutral: { bg: 'var(--mui-palette-action-selected)', fg: 'var(--mui-palette-text-primary)' },
  red:     { bg: 'var(--mui-palette-error-main)',      fg: '#fff' },
  amber:   { bg: 'var(--mui-palette-warning-main)',    fg: '#000' },
  green:   { bg: 'var(--mui-palette-success-main)',    fg: '#fff' },
  teal:    { bg: 'var(--chart-3, var(--color-accent))',   fg: '#fff' },
  blue:    { bg: 'var(--chart-1, var(--color-accent))',   fg: '#fff' },
  violet:  { bg: 'var(--chart-5, var(--color-accent-2))', fg: '#fff' },
  pink:    { bg: 'var(--chart-4, var(--color-accent-2))', fg: '#fff' },
}

export const colorOf = (key: string): Swatch => TAG_COLORS[key as TagColorKey] ?? TAG_COLORS.neutral
export const COLOR_KEYS = Object.keys(TAG_COLORS) as TagColorKey[]
```

- [ ] **Step 2: Add api types + fetchers** — in `frontend/src/api.ts`, add types near the top (after `Deadline`) and fetchers after `setConfig`:

```ts
export interface Tag { id: number; name: string; color: string }
export interface ContentTag { tag_id: number; name: string; color: string }
export interface ContentLink { id: number; target_type: string; target_id: number; label: string }
export interface ContentRefs { tags: ContentTag[]; links: ContentLink[] }
```

```ts
export const getTags = () => fetchJson<Tag[]>('/api/tags')
export const createTag = (name: string, color = 'neutral') =>
  postJson<{ id: number }>('/api/tags', { name, color })
export const getContentRefs = (refType: string, refId: number) =>
  fetchJson<ContentRefs>(`/api/content/${refType}/${refId}/refs`)
export const tagContent = (refType: string, refId: number, name: string, color = 'neutral') =>
  postJson<{ ok: boolean }>(`/api/content/${refType}/${refId}/tags`, { name, color })
export const untagContent = (refType: string, refId: number, tagId: number) =>
  del<{ deleted: number }>(`/api/content/${refType}/${refId}/tags/${tagId}`)
export const linkContent = (refType: string, refId: number, target_type: string, target_id: number) =>
  postJson<{ ok: boolean }>(`/api/content/${refType}/${refId}/links`, { target_type, target_id })
export const unlinkContent = (refType: string, refId: number, linkId: number) =>
  del<{ deleted: number }>(`/api/content/${refType}/${refId}/links/${linkId}`)
```

- [ ] **Step 3: Add `TagChips.tsx`** — create `frontend/src/components/TagChips.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Box, Chip } from '@mui/material'
import { User, Hash } from 'lucide-react'
import { colorOf } from '@/lib/tagColors'
import type { ContentTag, ContentLink } from '@/api'

const LINK_ICON: Record<string, ReactNode> = { person: <User size={11} />, topic: <Hash size={11} /> }

interface Props {
  tags?: ContentTag[]
  links?: ContentLink[]
  onTagClick?: (t: ContentTag) => void
  onLinkClick?: (l: ContentLink) => void
}

/** Display-only tag + link chips (colors from palette keys). Pass onClick handlers
 *  to make chips actionable (filter / navigate). */
export function TagChips({ tags = [], links = [], onTagClick, onLinkClick }: Props) {
  if (!tags.length && !links.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
      {links.map((l) => (
        <Chip
          key={`k${l.id}`} size="small" icon={LINK_ICON[l.target_type] as ReactNode} label={l.label}
          onClick={onLinkClick ? () => onLinkClick(l) : undefined}
          sx={{ height: 20, fontSize: 10, cursor: onLinkClick ? 'pointer' : 'default' }}
        />
      ))}
      {tags.map((t) => {
        const c = colorOf(t.color)
        return (
          <Chip
            key={`t${t.tag_id}`} size="small" label={t.name}
            onClick={onTagClick ? () => onTagClick(t) : undefined}
            sx={{ height: 20, fontSize: 10, bgcolor: c.bg, color: c.fg, cursor: onTagClick ? 'pointer' : 'default' }}
          />
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 4: Add `TagEditor.tsx`** — create `frontend/src/components/TagEditor.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Typography, TextField, MenuItem, Button, Autocomplete } from '@mui/material'
import {
  getContentRefs, getTags, tagContent, untagContent, linkContent, unlinkContent,
  getPeople, getTopics, type ContentRefs,
} from '@/api'
import { COLOR_KEYS } from '@/lib/tagColors'
import { TagChips } from './TagChips'
import { toast } from 'sonner'

const TARGET_TYPES = [{ value: 'person', label: 'Person' }, { value: 'topic', label: 'Topic' }] as const

/** Universal tag + link editor for any content row. Self-contained: mutates then
 *  invalidates ['content-refs', refType, refId] (and ['deadlines'] etc. via prefix). */
export function TagEditor({ refType, refId }: { refType: string; refId: number }) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['content-refs', refType, refId] })
    qc.invalidateQueries({ queryKey: [`${refType}s`] })  // e.g. ['deadlines'] row enrichment
  }
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('neutral')
  const [targetType, setTargetType] = useState<'person' | 'topic'>('person')
  const [targetId, setTargetId] = useState<number | ''>('')

  const { data: refs = { tags: [], links: [] } as ContentRefs } = useQuery({
    queryKey: ['content-refs', refType, refId], queryFn: () => getContentRefs(refType, refId),
  })
  const { data: allTags = [] } = useQuery({ queryKey: ['tags'], queryFn: getTags })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople() })
  const { data: topics = [] } = useQuery({ queryKey: ['topics'], queryFn: () => getTopics() })

  const targetOptions = targetType === 'person'
    ? people.map((p) => ({ id: p.id, label: p.name }))
    : topics.map((t) => ({ id: t.id, label: t.name }))

  const addTag = useMutation({
    mutationFn: () => tagContent(refType, refId, tagName.trim(), tagColor),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['tags'] }); setTagName('') },
    onError: () => toast.error('Failed to add tag'),
  })
  const rmTag = useMutation({
    mutationFn: (tagId: number) => untagContent(refType, refId, tagId), onSuccess: invalidate,
  })
  const addLink = useMutation({
    mutationFn: () => linkContent(refType, refId, targetType, targetId as number),
    onSuccess: () => { invalidate(); setTargetId('') },
    onError: () => toast.error('Failed to add link'),
  })
  const rmLink = useMutation({
    mutationFn: (linkId: number) => unlinkContent(refType, refId, linkId), onSuccess: invalidate,
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
      <Typography variant="overline" color="text.secondary">Tags & links</Typography>
      {(refs.tags.length > 0 || refs.links.length > 0) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          {refs.links.map((l) => (
            <TagChips key={`L${l.id}`} links={[l]} onLinkClick={() => rmLink.mutate(l.id)} />
          ))}
          {refs.tags.map((t) => (
            <TagChips key={`T${t.tag_id}`} tags={[t]} onTagClick={() => rmTag.mutate(t.tag_id)} />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Autocomplete
          freeSolo size="small" sx={{ flex: 1 }} options={allTags.map((t) => t.name)} inputValue={tagName}
          onInputChange={(_e, v) => setTagName(v)}
          renderInput={(params) => <TextField {...params} label="Tag" />}
        />
        <TextField
          select size="small" label="Color" value={tagColor} onChange={(e) => setTagColor(e.target.value)}
          sx={{ minWidth: 100 }} slotProps={{ htmlInput: { 'aria-label': 'Tag color' } }}
        >
          {COLOR_KEYS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
        </TextField>
        <Button size="small" variant="outlined" disabled={!tagName.trim() || addTag.isPending} onClick={() => addTag.mutate()}>
          Tag
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          select size="small" label="Link to" value={targetType}
          onChange={(e) => { setTargetType(e.target.value as 'person' | 'topic'); setTargetId('') }}
          sx={{ minWidth: 110 }}
        >
          {TARGET_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label="Item" value={targetId} sx={{ flex: 1 }}
          onChange={(e) => setTargetId(Number(e.target.value))}
          slotProps={{ htmlInput: { 'aria-label': 'Link item' } }}
        >
          {targetOptions.length === 0
            ? <MenuItem value="" disabled>None available</MenuItem>
            : targetOptions.map((o) => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
        </TextField>
        <Button size="small" variant="outlined" disabled={targetId === '' || addLink.isPending} onClick={() => addLink.mutate()}>
          Link
        </Button>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 5: Write the failing test** — create `frontend/src/components/TagChips.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagChips } from './TagChips'

describe('TagChips', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<TagChips />)
    expect(container.firstChild).toBeNull()
  })

  it('renders tag + link labels and fires click handlers', () => {
    const onTagClick = vi.fn()
    const onLinkClick = vi.fn()
    render(
      <TagChips
        tags={[{ tag_id: 1, name: 'urgent', color: 'amber' }]}
        links={[{ id: 2, target_type: 'person', target_id: 3, label: 'Ada' }]}
        onTagClick={onTagClick} onLinkClick={onLinkClick}
      />,
    )
    fireEvent.click(screen.getByText('urgent'))
    fireEvent.click(screen.getByText('Ada'))
    expect(onTagClick).toHaveBeenCalledOnce()
    expect(onLinkClick).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 6: Run FE checks — expect pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run src/components/TagChips.test.tsx`
Expected: tsc clean; 2 passed.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/tagColors.ts frontend/src/api.ts frontend/src/components/TagChips.tsx frontend/src/components/TagEditor.tsx frontend/src/components/TagChips.test.tsx
git commit -m "feat(tags): FE primitives — tagColors, TagChips, TagEditor, api"
```

---

### Task 6: Cutover — migrate deadlines onto the universal system

This is the atomic swap: move existing deadline tag/link data, delete the old deadline-specific tables/helpers/endpoints/component, and retarget the Deadlines UI. Do it as one task so the app is never in a broken half-migrated state.

**Files:**
- Modify: `backend/ea/db.py` (`_migrate` add migration block; delete old deadline link/tag helpers + `_REF_LABEL_SQL`)
- Modify: `backend/ea/features.sql` (remove the `deadline_tags`/`deadline_links` CREATE + index lines)
- Modify: `backend/web/app.py` (remove `LinkBody`/`TagBody` + 4 deadline link/tag endpoints; switch `get_deadlines` enrichment to universal helpers)
- Delete: `frontend/src/components/DeadlineRefsEditor.tsx`
- Modify: `frontend/src/views/Deadlines.tsx` (use `TagEditor`/`TagChips`, universal nav map)
- Modify: `frontend/src/api.ts` (drop deadline link/tag types+fetchers; `Deadline.links`/`.tags` become `ContentLink[]`/`ContentTag[]`)
- Create: `backend/tests/test_tags_migration.py`
- Modify: `backend/tests/test_deadlines_db.py` (remove the 3 old link/tag tests added for the deadline-specific helpers)
- Modify: `backend/tests/test_web_deadlines.py` (assert enrichment shape uses tag_id)

**Interfaces:**
- Consumes: all Task 1–5 helpers/components. `get_deadlines` now returns `links: [{id,target_type,target_id,label}]`, `tags: [{tag_id,name,color}]`.

- [ ] **Step 1: Write the failing migration test** — create `backend/tests/test_tags_migration.py`:

```python
import sqlite3
from ea import db


def test_migrate_moves_deadline_tags_and_links(tmp_path):
    p = tmp_path / "ea.sqlite"
    # Build a DB that still has the OLD deadline tables with data, as a pre-migration DB would.
    conn = db.get_conn(p)
    conn.executescript(db.DEFAULT_SCHEMA.read_text())
    conn.executescript("""
      CREATE TABLE IF NOT EXISTS critical_deadlines (id INTEGER PRIMARY KEY, title TEXT, due_at TEXT, source TEXT, external_ref TEXT);
      CREATE TABLE deadline_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, deadline_id INTEGER, tag TEXT, UNIQUE(deadline_id, tag));
      CREATE TABLE deadline_links (id INTEGER PRIMARY KEY AUTOINCREMENT, deadline_id INTEGER, ref_type TEXT, ref_id INTEGER, UNIQUE(deadline_id, ref_type, ref_id));
      INSERT INTO people (name) VALUES ('Ada');
      INSERT INTO critical_deadlines (id, title, due_at, source) VALUES (1, 'Ship', '2099-01-01T00:00:00+00:00', 'manual');
      INSERT INTO deadline_tags (deadline_id, tag) VALUES (1, 'q3');
      INSERT INTO deadline_links (deadline_id, ref_type, ref_id) VALUES (1, 'person', 1);
    """)
    # create the universal tables (features.sql) then run the migration
    conn.executescript(db.DEFAULT_FEATURES.read_text())
    db._migrate(conn)

    tags = db.list_tags_for(conn, "deadline", 1)
    links = db.list_links_for(conn, "deadline", 1)
    assert [t["name"] for t in tags] == ["q3"]
    assert links[0]["target_type"] == "person" and links[0]["label"] == "Ada"
    # old tables dropped
    got = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('deadline_tags','deadline_links')").fetchall()
    assert got == []
    # re-run is a no-op (no duplicates, no crash)
    db._migrate(conn)
    assert len(db.list_tags_for(conn, "deadline", 1)) == 1
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && ../.venv/bin/pytest tests/test_tags_migration.py -q`
Expected: FAIL (old tables not dropped / data not moved).

- [ ] **Step 3: Add the migration block** — in `backend/ea/db.py` `_migrate`, append before the function returns:

```python
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
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && ../.venv/bin/pytest tests/test_tags_migration.py -q`
Expected: PASS.

- [ ] **Step 5: Remove old `features.sql` CREATEs** — in `backend/ea/features.sql`, delete these lines (migration 005 block):

```sql
CREATE TABLE IF NOT EXISTS deadline_links ( … );
CREATE INDEX IF NOT EXISTS idx_deadline_links ON deadline_links(deadline_id);
CREATE TABLE IF NOT EXISTS deadline_tags ( … );
CREATE INDEX IF NOT EXISTS idx_deadline_tags ON deadline_tags(deadline_id);
```
(Delete the whole "Feature migration 005" section — the universal tables in migration 006 supersede it.)

- [ ] **Step 6: Delete old deadline db helpers** — in `backend/ea/db.py`, remove `_REF_LABEL_SQL` and the six functions `add_deadline_link`, `del_deadline_link`, `list_deadline_links`, `add_deadline_tag`, `del_deadline_tag`, `list_deadline_tags` (the entire "deadline cross-references (links + tags)" section added in the prior feature).

- [ ] **Step 7: Update `app.py`** — remove `class LinkBody` + `class TagBody`, remove the four endpoints `add_deadline_link`, `del_deadline_link`, `add_deadline_tag`, `del_deadline_tag`, and switch the enrichment inside `get_deadlines`:

Replace:
```python
            d["links"] = db.list_deadline_links(conn, d["id"])
            d["tags"] = [dict(t) for t in db.list_deadline_tags(conn, d["id"])]
```
with:
```python
            d["links"] = db.list_links_for(conn, "deadline", d["id"])
            d["tags"] = db.list_tags_for(conn, "deadline", d["id"])
```

- [ ] **Step 8: Update `backend/tests/test_deadlines_db.py`** — delete the three tests that call the removed helpers: `test_deadline_link_resolves_label_and_dedups`, `test_deadline_link_rejects_bad_ref_type`, `test_deadline_tag_add_list_del`, and the `_one_deadline` helper if now unused. (Coverage lives in `test_tags_db.py` + `test_tags_migration.py`.)

- [ ] **Step 9: Update `backend/tests/test_web_deadlines.py`** — if any test asserts the old `tags`/`links` shape, update to the universal shape. Add/adjust:

```python
def test_deadline_enriched_with_universal_tags(tmp_path):
    c = _client(tmp_path)
    did = c.post("/api/deadlines", json={"title": "X", "due_at": "2099-01-01T00:00:00+00:00"}).json()["id"]
    c.post(f"/api/content/deadline/{did}/tags", json={"name": "q3", "color": "teal"})
    row = [d for d in c.get("/api/deadlines").json() if d["id"] == did][0]
    assert row["tags"][0]["name"] == "q3" and "tag_id" in row["tags"][0]
```

- [ ] **Step 10: Retarget `Deadlines.tsx`** — replace the `DeadlineRefsEditor` import with `TagEditor`/`TagChips`, drop `DeadlineLink`/`REF_ROUTE` in favor of a person/topic nav map, and update the Refs column + modal:

Change the imports:
```tsx
import { getDeadlines, addDeadline, updateDeadline, setDeadlineVisible, setConfig, type Deadline } from '@/api'
import { formatCountdown } from '@/widgets/DeadlinesWidget'
import { TagEditor } from '@/components/TagEditor'
import { TagChips } from '@/components/TagChips'
import { useFriendlyTime } from '@/lib/timePrefs'
import { toast } from 'sonner'

const LINK_ROUTE: Record<string, string> = { person: '/people', topic: '/topics' }
```

Replace the `links` (Refs) column `renderCell` body with:
```tsx
      renderCell: (params) => (
        <TagChips
          tags={params.row.tags ?? []}
          links={params.row.links ?? []}
          onLinkClick={(l) => navigate(LINK_ROUTE[l.target_type] ?? '/')}
        />
      ),
```

Replace the modal refs editor block:
```tsx
            {editingId && <TagEditor refType="deadline" refId={editingId} />}
```

- [ ] **Step 11: Update `api.ts` Deadline type** — remove `DeadlineLink`/`DeadlineTag` interfaces and the four `addDeadlineLink`/`deleteDeadlineLink`/`addDeadlineTag`/`deleteDeadlineTag` fetchers; change `Deadline`:
```ts
  links?: ContentLink[]
  tags?: ContentTag[]
```

- [ ] **Step 12: Delete `DeadlineRefsEditor.tsx`**

```bash
git rm frontend/src/components/DeadlineRefsEditor.tsx
```

- [ ] **Step 13: Run the whole suite**

Run: `cd backend && ../.venv/bin/pytest -q` → all pass.
Run: `cd frontend && npx tsc --noEmit && npx vitest run && npm run build` → tsc clean, all tests pass, build succeeds.
Expected: green across the board (Deadlines still renders refs via the universal path).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "refactor(tags): migrate deadlines onto universal tags/links; drop deadline-specific system"
```

---

### Task 7: Skill awareness (tagging convention)

**Files:**
- Modify: `skills/README.md`
- Modify: `skills/trending_search/SKILL.md`, `skills/research_topics/SKILL.md`, `skills/compile_learning_email/SKILL.md`, `skills/extract_research_training_email/SKILL.md`, `skills/triage_email/SKILL.md`, `skills/triage_teams/SKILL.md`

**Interfaces:** none (prompt docs). Skills call the MCP tools `tag_content`/`link_content`/`list_tags` from Task 4.

- [ ] **Step 1: Add the convention to `skills/README.md`** — append a section:

```markdown
## Tagging & links convention

Every content row a skill creates (signal, trend, trend_finding, learning, news, event,
deadline, task) should be associated so the Data Feed can cross-reference it:

- Call `link_content(ref_type, ref_id, target_type, target_id)` to connect the row to the
  relevant **person(s)** and **topic(s)** it concerns (`target_type` in `person|topic`).
- Call `tag_content(ref_type, ref_id, tag, color?)` with 1–3 short lowercase labels.
  For trends/news, include an origin label: `internal` (Teams/email chatter) or
  `external` (news/web). `color` is a palette key (`neutral|red|amber|green|teal|blue|violet|pink`).
- Call `list_tags()` first and reuse an existing tag name before inventing a new one.
```

- [ ] **Step 2: Add a reminder block to each content-producing skill** — append to each of the six `SKILL.md` files listed above (adjust the `ref_type` to the row that skill creates):

```markdown
## Associate what you create
After inserting each row, associate it:
- `link_content(<ref_type>, <id>, "topic", <topic_id>)` for its topic(s); `"person"` for people it concerns.
- `tag_content(<ref_type>, <id>, "<label>")` with 1–3 reused labels (`list_tags()` first).
  Trending/news rows also get an `internal` or `external` origin tag.
```

Use the correct `<ref_type>` per skill: `trending_search`/`compute_trends` → `trend_finding`/`trend`; `research_topics` → `signal`; `compile_learning_email`/`extract_research_training_email` → `learning`; `triage_email`/`triage_teams` → `signal`.

- [ ] **Step 3: Verify the blocks landed**

Run: `grep -l "Associate what you create" skills/*/SKILL.md | wc -l`
Expected: `6`.

- [ ] **Step 4: Commit**

```bash
git add skills/README.md skills/*/SKILL.md
git commit -m "docs(skills): tagging & links convention for content-producing skills"
```

---

## Self-Review

**Spec coverage:** tables (T1) ✓; whitelists/injection guard (T1/T2) ✓; color palette keys (T1 schema, T5 `tagColors`) ✓; deadline migration + `features.sql` cleanup (T6) ✓; all db helpers (T1/T2) ✓; 7 endpoints (T3) ✓; 3 MCP tools (T4) ✓; skill convention (T7) ✓; FE primitives `TagChips`/`TagEditor`/`tagColors` + Deadlines retarget (T5/T6) ✓; test matrix (each task) ✓; SP2/SP3 correctly deferred.

**Placeholder scan:** every code step carries full code; no TBD/"handle edge cases"; the only `<ref_type>` placeholders (T7) are explicitly enumerated per skill. Clean.

**Type consistency:** `list_tags_for` returns `{tag_id,name,color}` — used identically in T3 test, T5 `ContentTag`, T6 enrichment, and `TagChips`. `list_links_for` returns `{id,target_type,target_id,label}` = `ContentLink`. `tag_content(ref_type,ref_id,name,color)` signature consistent across db/tools/MCP/endpoint. `get_deadlines` enrichment (T6) matches `Deadline.tags/links` (T6 api change). Migration raw-insert into `content_links` matches the `list_links_for` fallback tested in T2. Consistent.
