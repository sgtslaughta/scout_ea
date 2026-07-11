# Outgoing Actions — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Scout a draft-first outgoing-actions engine: an `actions` table, MCP tools + web API to draft/approve/execute/report actions, a guidance store, and the `scout_actions` brain skill + parallel executor skills.

**Architecture:** One `actions` sqlite table holds every action through a `drafted→approved→executing→completed|failed` (+`dismissed`) lifecycle. `db.py` gains thin primitives; `mcp_server` exposes them as agent tools; `web/app.py` exposes UI-facing status flips (never sends). The `scout_actions` SKILL.md drafts; `run_comms`/`run_teams`/`run_calendar`/`run_cowork` SKILL.md files execute approved actions in parallel loops, claiming rows atomically. MS Copilot Scout (desktop host) runs the skills on schedule and bridges M365/local.

**Tech Stack:** Python stdlib `sqlite3`, FastMCP, FastAPI + pydantic, pytest. SKILL.md markdown.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-outgoing-actions-design.md`.
- sqlite via `ea/db.py` `get_conn` (Row factory, WAL, FK on). No ORM.
- New tables go in `ea/schema.sql` as `CREATE TABLE IF NOT EXISTS` (re-run every `init_db`; no `_migrate` entry needed).
- MCP tools are thin wrappers in `mcp_server/tools.py` + `@mcp.tool()` in `server.py`, mirroring `add_task`.
- Web routes: `@app.<verb>("/api/...")`, pydantic body models, `conn=Depends(get_db)`, `_rows` helper.
- `payload` and `result` columns store JSON **text**; encode/decode at the `db.py` boundary so callers pass/receive dicts.
- Action types (v1): `email_reply|email_forward|email_new|teams_dm|teams_group|teams_post|status_set|calendar_invite|cowork_doc|cowork_gather`.
- Executor→types map: `run_comms`=email_*/status_set; `run_teams`=teams_*; `run_calendar`=calendar_invite; `run_cowork`=cowork_doc/cowork_gather.
- Tests live in `backend/tests/`. Run from `backend/` with `pytest`.

---

## File Structure

- `backend/ea/schema.sql` — add `actions` + `guidance` tables.
- `backend/ea/db.py` — add action + guidance primitives.
- `backend/mcp_server/tools.py` — thin wrappers.
- `backend/mcp_server/server.py` — `@mcp.tool()` definitions.
- `backend/web/app.py` — `/api/actions*` + `/api/guidance*` routes + pydantic models.
- `backend/tests/test_actions_db.py` — db primitives + lifecycle + claim.
- `backend/tests/test_actions_api.py` — web endpoints.
- `backend/tests/test_actions_mcp.py` — MCP tools smoke.
- `skills/scout_actions/SKILL.md` — brain (draft/report).
- `skills/run_comms/SKILL.md`, `skills/run_teams/SKILL.md`, `skills/run_calendar/SKILL.md`, `skills/run_cowork/SKILL.md` — executors.

---

## Task 1: `actions` + `guidance` schema

**Files:**
- Modify: `backend/ea/schema.sql` (append two tables)
- Test: `backend/tests/test_actions_db.py`

**Interfaces:**
- Produces: tables `actions`, `guidance` (columns per spec §A / §E).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_actions_db.py
from ea import db

def test_actions_and_guidance_tables_exist(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    cols = {r[1] for r in conn.execute("PRAGMA table_info(actions)")}
    assert {"id", "entity_type", "entity_id", "action_type", "mode", "status",
            "payload", "rationale", "created_by", "approved_at", "executed_at",
            "result", "error", "created_at"} <= cols
    gcols = {r[1] for r in conn.execute("PRAGMA table_info(guidance)")}
    assert {"id", "scope", "text", "created_at"} <= gcols
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_actions_db.py::test_actions_and_guidance_tables_exist -v`
Expected: FAIL (`no such table: actions`).

- [ ] **Step 3: Append tables to `ea/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS actions (
    id           INTEGER PRIMARY KEY,
    entity_type  TEXT,
    entity_id    INTEGER,
    action_type  TEXT NOT NULL,
    mode         TEXT NOT NULL DEFAULT 'review',
    status       TEXT NOT NULL DEFAULT 'drafted',
    payload      TEXT,
    rationale    TEXT,
    created_by   TEXT NOT NULL DEFAULT 'skill',
    approved_at  TEXT,
    executed_at  TEXT,
    result       TEXT,
    error        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guidance (
    id          INTEGER PRIMARY KEY,
    scope       TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_actions_db.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ea/schema.sql backend/tests/test_actions_db.py
git commit -m "feat(actions): actions + guidance tables"
```

---

## Task 2: `db.py` action primitives (create / list / update)

**Files:**
- Modify: `backend/ea/db.py` (append after existing primitives)
- Test: `backend/tests/test_actions_db.py`

**Interfaces:**
- Produces:
  - `add_action(conn, *, action_type, entity_type=None, entity_id=None, mode="review", status="drafted", payload=None, rationale=None, created_by="skill") -> int` (returns new id; `payload` dict → JSON).
  - `list_actions(conn, status=None, mode=None) -> list[dict]` (newest first; `payload`/`result` decoded to dict|None).
  - `update_action(conn, action_id, *, status=None, result=None, error=None) -> int` (rows affected; sets `approved_at` when status=`approved`, `executed_at` when status in {`completed`,`failed`}; `result` dict → JSON; always bumps `updated_at`).

- [ ] **Step 1: Write the failing test**

```python
def test_add_list_update_action(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    aid = db.add_action(conn, action_type="email_new", entity_type="signal",
                        entity_id=7, payload={"to": "x@y.com", "subject": "hi"},
                        rationale="follow up")
    assert aid > 0
    rows = db.list_actions(conn, status="drafted")
    assert len(rows) == 1 and rows[0]["payload"]["to"] == "x@y.com"
    n = db.update_action(conn, aid, status="completed",
                         result={"ok": True, "access_url": "http://d/1"})
    assert n == 1
    got = db.list_actions(conn)[0]
    assert got["status"] == "completed"
    assert got["result"]["access_url"] == "http://d/1"
    assert got["executed_at"] is not None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && pytest tests/test_actions_db.py::test_add_list_update_action -v`
Expected: FAIL (`module 'ea.db' has no attribute 'add_action'`).

- [ ] **Step 3: Implement in `ea/db.py`**

```python
import json

_ACTION_COLS = {"entity_type", "entity_id", "action_type", "mode", "status",
                "payload", "rationale", "created_by"}

def _decode_action(row: sqlite3.Row) -> dict:
    d = dict(row)
    for k in ("payload", "result"):
        d[k] = json.loads(d[k]) if d.get(k) else None
    return d

def add_action(conn, *, action_type, entity_type=None, entity_id=None,
               mode="review", status="drafted", payload=None, rationale=None,
               created_by="skill") -> int:
    fields = {"action_type": action_type, "entity_type": entity_type,
              "entity_id": entity_id, "mode": mode, "status": status,
              "payload": json.dumps(payload) if payload is not None else None,
              "rationale": rationale, "created_by": created_by}
    fields = {k: v for k, v in fields.items() if v is not None}
    bad = set(fields) - _ACTION_COLS
    if bad:
        raise ValueError(f"unknown action columns: {bad}")
    cols = ", ".join(fields)
    ph = ", ".join("?" for _ in fields)
    cur = conn.execute(f"INSERT INTO actions ({cols}) VALUES ({ph})",
                       list(fields.values()))
    conn.commit()
    return cur.lastrowid

def list_actions(conn, status=None, mode=None) -> list:
    sql = "SELECT * FROM actions"
    clauses, params = [], []
    if status is not None:
        clauses.append("status=?"); params.append(status)
    if mode is not None:
        clauses.append("mode=?"); params.append(mode)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY created_at DESC, id DESC"
    return [_decode_action(r) for r in conn.execute(sql, params).fetchall()]

def update_action(conn, action_id, *, status=None, result=None, error=None) -> int:
    sets, params = ["updated_at=datetime('now')"], []
    if status is not None:
        sets.append("status=?"); params.append(status)
        if status == "approved":
            sets.append("approved_at=datetime('now')")
        if status in ("completed", "failed"):
            sets.append("executed_at=datetime('now')")
    if result is not None:
        sets.append("result=?"); params.append(json.dumps(result))
    if error is not None:
        sets.append("error=?"); params.append(error)
    params.append(action_id)
    cur = conn.execute(f"UPDATE actions SET {', '.join(sets)} WHERE id=?", params)
    conn.commit()
    return cur.rowcount
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && pytest tests/test_actions_db.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_actions_db.py
git commit -m "feat(actions): db add/list/update_action primitives"
```

---

## Task 3: Atomic claim + open-action dedup

**Files:**
- Modify: `backend/ea/db.py`
- Test: `backend/tests/test_actions_db.py`

**Interfaces:**
- Produces:
  - `claim_action(conn, action_id) -> bool` — atomically flip to `executing` only if currently `approved` (review) OR `drafted`+`mode=auto`. Returns True iff this caller won the claim.
  - `has_open_action(conn, entity_type, entity_id, action_type) -> bool` — True if a row with the same entity+type is in `drafted`/`approved`/`executing`, or `completed` within the last 24h (dedup guard).

- [ ] **Step 1: Write the failing test**

```python
def test_claim_is_exclusive_and_dedup(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    aid = db.add_action(conn, action_type="email_new", mode="review", status="approved")
    assert db.claim_action(conn, aid) is True      # first wins
    assert db.claim_action(conn, aid) is False     # already executing
    auto = db.add_action(conn, action_type="cowork_doc", mode="auto")  # drafted+auto
    assert db.claim_action(conn, auto) is True
    db.add_action(conn, action_type="teams_dm", entity_type="person",
                  entity_id=3, status="drafted")
    assert db.has_open_action(conn, "person", 3, "teams_dm") is True
    assert db.has_open_action(conn, "person", 3, "email_new") is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && pytest tests/test_actions_db.py::test_claim_is_exclusive_and_dedup -v`
Expected: FAIL (`no attribute 'claim_action'`).

- [ ] **Step 3: Implement in `ea/db.py`**

```python
def claim_action(conn, action_id) -> bool:
    cur = conn.execute(
        "UPDATE actions SET status='executing', updated_at=datetime('now') "
        "WHERE id=? AND (status='approved' OR (status='drafted' AND mode='auto'))",
        (action_id,))
    conn.commit()
    return cur.rowcount == 1

def has_open_action(conn, entity_type, entity_id, action_type) -> bool:
    row = conn.execute(
        "SELECT 1 FROM actions WHERE entity_type=? AND entity_id=? AND action_type=? "
        "AND (status IN ('drafted','approved','executing') "
        "     OR (status='completed' AND executed_at > datetime('now','-1 day'))) "
        "LIMIT 1", (entity_type, entity_id, action_type)).fetchone()
    return row is not None
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && pytest tests/test_actions_db.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_actions_db.py
git commit -m "feat(actions): atomic claim_action + has_open_action dedup"
```

---

## Task 4: Guidance primitives

**Files:**
- Modify: `backend/ea/db.py`
- Test: `backend/tests/test_actions_db.py`

**Interfaces:**
- Produces:
  - `add_guidance(conn, scope, text) -> int`
  - `list_guidance(conn, scope=None) -> list[dict]` (newest first; if `scope` given, exact match OR `global`)
  - `delete_guidance(conn, guidance_id) -> int`

- [ ] **Step 1: Write the failing test**

```python
def test_guidance_crud(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    gid = db.add_guidance(conn, "topic:AI", "ignore vendor spam")
    db.add_guidance(conn, "global", "keep replies short")
    scoped = db.list_guidance(conn, scope="topic:AI")
    texts = {g["text"] for g in scoped}
    assert "ignore vendor spam" in texts and "keep replies short" in texts  # global included
    assert db.delete_guidance(conn, gid) == 1
    assert all(g["text"] != "ignore vendor spam" for g in db.list_guidance(conn))
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && pytest tests/test_actions_db.py::test_guidance_crud -v`
Expected: FAIL.

- [ ] **Step 3: Implement in `ea/db.py`**

```python
def add_guidance(conn, scope, text) -> int:
    cur = conn.execute("INSERT INTO guidance (scope, text) VALUES (?, ?)", (scope, text))
    conn.commit()
    return cur.lastrowid

def list_guidance(conn, scope=None) -> list:
    if scope is None:
        rows = conn.execute("SELECT * FROM guidance ORDER BY created_at DESC, id DESC")
    else:
        rows = conn.execute(
            "SELECT * FROM guidance WHERE scope=? OR scope='global' "
            "ORDER BY created_at DESC, id DESC", (scope,))
    return [dict(r) for r in rows.fetchall()]

def delete_guidance(conn, guidance_id) -> int:
    cur = conn.execute("DELETE FROM guidance WHERE id=?", (guidance_id,))
    conn.commit()
    return cur.rowcount
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && pytest tests/test_actions_db.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_actions_db.py
git commit -m "feat(actions): guidance add/list/delete primitives"
```

---

## Task 5: MCP tools

**Files:**
- Modify: `backend/mcp_server/tools.py` (thin wrappers)
- Modify: `backend/mcp_server/server.py` (`@mcp.tool()` defs)
- Test: `backend/tests/test_actions_mcp.py`

**Interfaces:**
- Consumes: `db.add_action/list_actions/update_action/claim_action/has_open_action/add_guidance/list_guidance` (Tasks 2-4).
- Produces MCP tools: `add_action`, `list_actions`, `update_action`, `claim_action`, `has_open_action`, `add_guidance`, `list_guidance`.

- [ ] **Step 1: Write the failing test** (drives the FastMCP server object)

```python
# backend/tests/test_actions_mcp.py
from mcp_server.server import build_server

def test_action_tools_registered(tmp_path):
    mcp = build_server(tmp_path / "t.db")
    names = {t.name for t in mcp._tool_manager.list_tools()}
    assert {"add_action", "list_actions", "update_action", "claim_action",
            "has_open_action", "add_guidance", "list_guidance"} <= names
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && pytest tests/test_actions_mcp.py -v`
Expected: FAIL (names missing). *(If `_tool_manager.list_tools()` differs in this FastMCP version, adapt to the attribute the existing tests use; check `tests/test_mcp_server.py` for the exact accessor.)*

- [ ] **Step 3a: Add wrappers to `mcp_server/tools.py`**

```python
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
```

- [ ] **Step 3b: Add `@mcp.tool()` defs in `server.py`** (inside `build_server`, alongside the others)

```python
    @mcp.tool()
    def add_action(action_type: str, entity_type: str | None = None,
                   entity_id: int | None = None, mode: str = "review",
                   payload: dict | None = None, rationale: str | None = None,
                   created_by: str = "skill") -> int:
        """Draft an outgoing action. mode 'review' needs approval; 'auto' runs unattended.
        Returns the new action id."""
        conn = _conn()
        try:
            return tools.add_action(conn, action_type=action_type, entity_type=entity_type,
                                    entity_id=entity_id, mode=mode, payload=payload,
                                    rationale=rationale, created_by=created_by)
        finally:
            conn.close()

    @mcp.tool()
    def list_actions(status: str | None = None, mode: str | None = None) -> list[dict]:
        """List actions (optionally by status/mode), newest first."""
        conn = _conn()
        try:
            return tools.list_actions(conn, status=status, mode=mode)
        finally:
            conn.close()

    @mcp.tool()
    def update_action(action_id: int, status: str | None = None,
                      result: dict | None = None, error: str | None = None) -> int:
        """Write back an action's status/result/error. Returns rows affected."""
        conn = _conn()
        try:
            return tools.update_action(conn, action_id, status=status, result=result, error=error)
        finally:
            conn.close()

    @mcp.tool()
    def claim_action(action_id: int) -> bool:
        """Atomically claim an action for execution (approved, or auto+drafted).
        Returns True iff this caller won the claim."""
        conn = _conn()
        try:
            return tools.claim_action(conn, action_id)
        finally:
            conn.close()

    @mcp.tool()
    def has_open_action(entity_type: str, entity_id: int, action_type: str) -> bool:
        """True if an equivalent action is open or was completed in the last 24h (dedup guard)."""
        conn = _conn()
        try:
            return tools.has_open_action(conn, entity_type, entity_id, action_type)
        finally:
            conn.close()

    @mcp.tool()
    def add_guidance(scope: str, text: str) -> int:
        """Store user guidance for a scope (e.g. 'topic:AI', 'person:5', 'global'). Returns id."""
        conn = _conn()
        try:
            return tools.add_guidance(conn, scope, text)
        finally:
            conn.close()

    @mcp.tool()
    def list_guidance(scope: str | None = None) -> list[dict]:
        """List guidance; if scope given, returns that scope plus 'global'."""
        conn = _conn()
        try:
            return tools.list_guidance(conn, scope=scope)
        finally:
            conn.close()
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && pytest tests/test_actions_mcp.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_server/tools.py backend/mcp_server/server.py backend/tests/test_actions_mcp.py
git commit -m "feat(actions): MCP tools for actions + guidance"
```

---

## Task 6: Web API — actions endpoints

**Files:**
- Modify: `backend/web/app.py` (pydantic models near the others; routes after `/api/tasks`)
- Test: `backend/tests/test_actions_api.py`

**Interfaces:**
- Consumes: `db.add_action/list_actions/update_action` (Tasks 2-3).
- Produces routes:
  - `GET /api/actions?status=` → `list[dict]`
  - `POST /api/actions` (`ActionCreate`) → `{"id": int}` (`created_by='user'`; if `approve=True` → `status='approved'` + `approved_at`)
  - `POST /api/actions/{id}/approve` → `{"updated": n}`
  - `POST /api/actions/{id}/dismiss` → `{"updated": n}`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_actions_api.py
from fastapi.testclient import TestClient
from web.app import create_app

def _client(tmp_path):
    from ea import db
    p = tmp_path / "t.db"; db.init_db(p)
    return TestClient(create_app(p))

def test_action_create_list_approve_dismiss(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/actions", json={"action_type": "email_new",
               "payload": {"to": "a@b.com"}, "rationale": "hi"})
    assert r.status_code == 200
    aid = r.json()["id"]
    lst = c.get("/api/actions?status=drafted").json()
    assert any(a["id"] == aid for a in lst)
    assert c.post(f"/api/actions/{aid}/approve").json()["updated"] == 1
    assert c.get("/api/actions?status=approved").json()[0]["id"] == aid
    assert c.post(f"/api/actions/{aid}/dismiss").json()["updated"] == 1
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && pytest tests/test_actions_api.py -v`
Expected: FAIL (404 on `/api/actions`).

- [ ] **Step 3a: Add pydantic models** (near `TaskCreate`)

```python
class ActionCreate(BaseModel):
    action_type: str
    entity_type: str | None = None
    entity_id: int | None = None
    mode: str = "review"
    payload: dict | None = None
    rationale: str | None = None
    approve: bool = False
```

- [ ] **Step 3b: Add routes** (after the `/api/tasks` block)

```python
    @app.get("/api/actions")
    def list_actions_ep(status: str | None = None, conn=Depends(get_db)):
        return db.list_actions(conn, status=status)

    @app.post("/api/actions")
    def create_action_ep(body: ActionCreate, conn=Depends(get_db)):
        status = "approved" if body.approve else "drafted"
        aid = db.add_action(conn, action_type=body.action_type,
                            entity_type=body.entity_type, entity_id=body.entity_id,
                            mode=body.mode, status=status, payload=body.payload,
                            rationale=body.rationale, created_by="user")
        if body.approve:
            db.update_action(conn, aid, status="approved")  # stamps approved_at
        return {"id": aid}

    @app.post("/api/actions/{action_id}/approve")
    def approve_action_ep(action_id: int, conn=Depends(get_db)):
        n = db.update_action(conn, action_id, status="approved")
        if n == 0:
            raise HTTPException(status_code=404, detail="action not found")
        return {"updated": n}

    @app.post("/api/actions/{action_id}/dismiss")
    def dismiss_action_ep(action_id: int, conn=Depends(get_db)):
        n = db.update_action(conn, action_id, status="dismissed")
        if n == 0:
            raise HTTPException(status_code=404, detail="action not found")
        return {"updated": n}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && pytest tests/test_actions_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/tests/test_actions_api.py
git commit -m "feat(actions): web API for action draft/approve/dismiss"
```

---

## Task 7: Web API — guidance endpoints

**Files:**
- Modify: `backend/web/app.py`
- Test: `backend/tests/test_actions_api.py`

**Interfaces:**
- Consumes: `db.add_guidance/list_guidance/delete_guidance` (Task 4).
- Produces: `GET /api/guidance?scope=`, `POST /api/guidance` (`GuidanceBody`), `DELETE /api/guidance/{id}`.

- [ ] **Step 1: Write the failing test**

```python
def test_guidance_endpoints(tmp_path):
    c = _client(tmp_path)
    gid = c.post("/api/guidance", json={"scope": "topic:AI", "text": "skip spam"}).json()["id"]
    got = c.get("/api/guidance?scope=topic:AI").json()
    assert any(g["text"] == "skip spam" for g in got)
    assert c.delete(f"/api/guidance/{gid}").json()["deleted"] == 1
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && pytest tests/test_actions_api.py::test_guidance_endpoints -v`
Expected: FAIL (404).

- [ ] **Step 3a: Add model** (near `ActionCreate`)

```python
class GuidanceBody(BaseModel):
    scope: str
    text: str
```

- [ ] **Step 3b: Add routes**

```python
    @app.get("/api/guidance")
    def list_guidance_ep(scope: str | None = None, conn=Depends(get_db)):
        return db.list_guidance(conn, scope=scope)

    @app.post("/api/guidance")
    def create_guidance_ep(body: GuidanceBody, conn=Depends(get_db)):
        return {"id": db.add_guidance(conn, body.scope, body.text)}

    @app.delete("/api/guidance/{guidance_id}")
    def delete_guidance_ep(guidance_id: int, conn=Depends(get_db)):
        return {"deleted": db.delete_guidance(conn, guidance_id)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && pytest tests/test_actions_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/tests/test_actions_api.py
git commit -m "feat(actions): web API for guidance CRUD"
```

---

## Task 8: `scout_actions` brain skill

**Files:**
- Create: `skills/scout_actions/SKILL.md`
- Test: `backend/tests/test_actions_skills.py`

**Interfaces:**
- Consumes: MCP `list_rows`, `list_guidance`, `has_open_action`, `add_action`, `log_skill_run`.
- Produces: draft `actions` rows. No execution.

- [ ] **Step 1: Write the failing test** (skill file parses with required frontmatter)

```python
# backend/tests/test_actions_skills.py
from pathlib import Path
from lib import skills

SKILLS = Path(__file__).resolve().parents[2] / "skills"

def test_scout_actions_skill_parses():
    s = skills.parse_skill_file(SKILLS / "scout_actions" / "SKILL.md")
    assert s["name"] == "scout_actions"
    assert "5m" in s["schedule"]
```

*(Confirm the parser fn name in `backend/lib/skills.py`; use whatever it exposes — e.g. `parse_skill_file` — and match the returned keys.)*

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && pytest tests/test_actions_skills.py::test_scout_actions_skill_parses -v`
Expected: FAIL (file missing).

- [ ] **Step 3: Create `skills/scout_actions/SKILL.md`**

```markdown
---
name: scout_actions
description: Scan recent signals/deadlines/people and draft outgoing actions for review; report each run. Does not execute.
schedule: heartbeat 5m
---

## Lookback window
Read the last `log_skill_run` entry for `scout_actions`; use its `ran_at` as `window_start`. If none, use `now - 5 min`.

## Gather candidates
Read new/recent items in `[window_start, now]`:
- `list_rows('signals', status='new')` — emails/Teams needing a reply.
- `list_rows('critical_deadlines')` — deadlines within 24h with no reply/nudge yet.
- `list_rows('tasks', status='open')` — tasks whose `detail` implies an outbound message.

## Apply guidance
For each candidate, call `list_guidance(scope=...)` for the relevant scope(s) — e.g. `topic:<name>`, `person:<id>`, `skill:scout_actions`, and `global`. Honor the notes (skip topics the user said to ignore, follow focus/tone hints). If guidance says to ignore, skip the candidate.

## Decide + draft
For each surviving candidate, pick the best action type:
- Reply-needed email → `email_reply` (mode `review`).
- Intro/nudge to a person → `teams_dm` or `email_new` (mode `review`).
- Meeting implied → `calendar_invite` (mode `review`).
- "Set my status" cue → `status_set` (mode `auto`).
- "Draft a doc" / "look up X" cue → `cowork_doc` / `cowork_gather` (mode `auto`).

Before drafting, call `has_open_action(entity_type, entity_id, action_type)`. If True, skip (dedup).

Otherwise draft with `add_action(action_type=..., entity_type=..., entity_id=..., mode=..., payload={...}, rationale="<why>")`. Fill `payload` with the concrete draft:
- email_*: `{to, subject, body, in_reply_to?}`
- teams_*: `{recipients:[...], message, channel?}`
- calendar_invite: `{title, start, end, attendees:[...], body}`
- status_set: `{text, expires_at?}`
- cowork_*: `{prompt, target?}`

## Report
Always finish with `log_skill_run(skill='scout_actions', items_created=<n>, status='ok', note=<summary or null>)`. If nothing drafted, log `items_created=0` and exit.
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && pytest tests/test_actions_skills.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/scout_actions/SKILL.md backend/tests/test_actions_skills.py
git commit -m "feat(actions): scout_actions brain skill"
```

---

## Task 9: Executor skills (`run_comms`, `run_teams`, `run_calendar`, `run_cowork`)

**Files:**
- Create: `skills/run_comms/SKILL.md`, `skills/run_teams/SKILL.md`, `skills/run_calendar/SKILL.md`, `skills/run_cowork/SKILL.md`
- Test: `backend/tests/test_actions_skills.py`

**Interfaces:**
- Consumes: MCP `list_actions`, `claim_action`, `update_action`, `log_skill_run`; host `m365.call` / local handlers.
- Produces: executed actions with `result`/`error` written back.

- [ ] **Step 1: Write the failing test**

```python
import pytest

@pytest.mark.parametrize("name,sched,owns", [
    ("run_comms", "5m", "email_new"),
    ("run_teams", "5m", "teams_dm"),
    ("run_calendar", "5m", "calendar_invite"),
    ("run_cowork", "10m", "cowork_doc"),
])
def test_executor_skill_parses(name, sched, owns):
    s = skills.parse_skill_file(SKILLS / name / "SKILL.md")
    assert s["name"] == name
    assert sched in s["schedule"]
    assert owns in (SKILLS / name / "SKILL.md").read_text()
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && pytest tests/test_actions_skills.py -k executor -v`
Expected: FAIL (files missing).

- [ ] **Step 3: Create the four SKILL.md files** (same shape; substitute the bracketed parts)

`skills/run_comms/SKILL.md`:

```markdown
---
name: run_comms
description: Execute approved email + status actions via M365; write results back.
schedule: heartbeat 5m
---

## Claim
Call `list_actions(status='approved')`; keep only `action_type` in `email_reply, email_forward, email_new, status_set`. Also include `list_actions(status='drafted', mode='auto')` filtered to `status_set`. For each, call `claim_action(id)`; proceed only if it returns True (another loop may have taken it).

## Run
For each claimed action, read its `payload` and call the host bridge:
- `email_reply` / `email_forward` / `email_new` → `m365.call('sendMail', payload)`.
- `status_set` → `m365.call('setPresence', payload)`.

## Write back
On success: `update_action(id, status='completed', result={"ok": true, "detail": "<what happened>"})`.
On failure: `update_action(id, status='failed', error="<message>")`.

## Report
Finish with `log_skill_run(skill='run_comms', items_created=<count executed>, status='ok', note=<summary or null>)`.
```

`skills/run_teams/SKILL.md` — same, but frontmatter `name: run_teams`, `schedule: heartbeat 5m`; Claim keeps `teams_dm, teams_group, teams_post`; Run maps each to `m365.call('sendChatMessage'|'createGroupChat'|'postChannelMessage', payload)`; report `skill='run_teams'`.

`skills/run_calendar/SKILL.md` — `name: run_calendar`, `schedule: heartbeat 5m`; Claim keeps `calendar_invite`; Run → `m365.call('createEvent', payload)` (reuse create_events attendee/time conventions); report `skill='run_calendar'`.

`skills/run_cowork/SKILL.md` — `name: run_cowork`, `schedule: heartbeat 10m`; Claim keeps `cowork_doc, cowork_gather` from both `approved` and `drafted`+`auto`; Run: for `cowork_doc` generate the document locally and set `result={"ok":true,"access_url":"<path/url>"}` (or open it); for `cowork_gather` query the data source and set `result={"ok":true,"detail":"<summary>","access_url":"<optional>"}`; report `skill='run_cowork'`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && pytest tests/test_actions_skills.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/run_comms skills/run_teams skills/run_calendar skills/run_cowork backend/tests/test_actions_skills.py
git commit -m "feat(actions): parallel executor skills (comms/teams/calendar/cowork)"
```

---

## Task 10: Full backend suite green

- [ ] **Step 1: Run the whole backend suite**

Run: `cd backend && pytest -q`
Expected: all pass (existing + new action/guidance/mcp/skills tests).

- [ ] **Step 2: If any pre-existing test broke, fix the regression** (do not edit unrelated tests to pass).

- [ ] **Step 3: Commit any fixups**

```bash
git add -A && git commit -m "test(actions): backend suite green"
```

---

## Self-Review (completed by author)

- **Spec coverage:** §A table → T1-2; lifecycle/claim → T2-3; §B MCP → T5, web API → T6-7; §C brain → T8, executors → T9; §E guidance store → T4/T7 (UI is the frontend plan). ✓
- **Placeholders:** none — every code step has full code. Two flagged "confirm the accessor" notes (FastMCP tool list in T5, `skills.py` parser name in T8) are verification cues, not gaps; the engineer checks the neighbouring existing test.
- **Type consistency:** `add_action` keyword-only signature identical across T2/T5/T6; `update_action(action_id, *, status, result, error)` consistent T2/T5/T6; `claim_action`→bool consistent T3/T5/T9.

## Out of scope (this plan)

Frontend (registry, ActionMenu, compose modal, Actions view, badges, touchpoints, guidance UI) → `2026-07-11-outgoing-actions-frontend.md`.
