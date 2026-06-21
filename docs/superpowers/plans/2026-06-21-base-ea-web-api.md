# Base EA — Web API Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A FastAPI HTTP+SSE service over `EA_DB` — read endpoints per table, control-loop status writes, and a live-change SSE stream driven by `PRAGMA data_version` — the browser-facing door of the two-surface architecture.

**Architecture:** FastAPI app in `backend/web/`, importing the existing `ea` package (Plan A) for all DB access. Read endpoints return JSON. Status writes reuse `ea.db.update_status` (whitelisted). A `wait_for_change(db_path, last_version, timeout)` helper polls `data_version`; the `/api/events` SSE endpoint wraps it. Unit-test the helper directly (not the HTTP stream).

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, `httpx`/`TestClient` for tests, stdlib `sqlite3` via `ea` package.

## Global Constraints

- All DB access goes through the `ea` package — no raw SQL in the web layer except via `ea.db`.
- Read endpoints are GET, return JSON; control-loop endpoints are POST.
- Status writes ONLY via `ea.db.update_status` (table whitelist) — never string-build table names in the web layer.
- SSE change detection uses `PRAGMA data_version` (a second connection observes the writer's commits).
- Bind host/port from `ea` config (`web_port`); default `127.0.0.1` (loopback only).
- Files under 500 lines; split routers if needed.
- A test DB is created per test via `ea.db.init_db(tmp, seed_path=ea.db.DEFAULT_SEED)`; the app reads its DB path from a dependency override (no global mutable state).

---

### Task 1: App skeleton + config + DB dependency

**Files:**
- Create: `backend/web/__init__.py` (empty)
- Create: `backend/web/app.py`
- Modify: `backend/pyproject.toml` (add deps)
- Test: `backend/tests/test_web_app.py`

**Interfaces:**
- Produces: `web.app.create_app(db_path) -> FastAPI`; route `GET /api/health` → `{"status":"ok"}`; route `GET /api/config` → `{key: value, ...}` from the `config` table; a FastAPI dependency `get_db()` yielding an `ea.db` connection for the configured path.

- [ ] **Step 1: Add deps to `backend/pyproject.toml`**

Under `[project]`, add a dependencies array (create it if absent):
```toml
dependencies = ["fastapi>=0.110", "uvicorn>=0.29"]

[project.optional-dependencies]
test = ["pytest", "httpx"]
```

- [ ] **Step 2: Install deps**

Run: `cd backend && python -m pip install -e ".[test]"`
Expected: fastapi, uvicorn, httpx, pytest installed (note versions in report).

- [ ] **Step 3: Write the failing test**

```python
# backend/tests/test_web_app.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_health(tmp_path):
    r = _client(tmp_path).get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_config_returns_seeded_keys(tmp_path):
    r = _client(tmp_path).get("/api/config")
    assert r.status_code == 200
    body = r.json()
    assert body["tz"] == "America/New_York"
    assert "web_port" in body
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_app.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'web'`

- [ ] **Step 5: Create `backend/web/__init__.py`** (empty)

- [ ] **Step 6: Create `backend/web/app.py`**

```python
"""FastAPI app over EA_DB — browser-facing surface."""
from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, Depends
from ea import db


def create_app(db_path) -> FastAPI:
    app = FastAPI(title="Scout EA")
    db_path = Path(db_path)

    def get_db():
        conn = db.get_conn(db_path)
        try:
            yield conn
        finally:
            conn.close()

    app.state.get_db = get_db

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/config")
    def get_config(conn=Depends(get_db)):
        rows = conn.execute("SELECT key, value FROM config").fetchall()
        return {r["key"]: r["value"] for r in rows}

    return app
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_web_app.py -v`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add backend/web/__init__.py backend/web/app.py backend/pyproject.toml backend/tests/test_web_app.py
git commit -m "feat(web): FastAPI app skeleton — health + config endpoints"
```

---

### Task 2: Read endpoints (signals, tasks, alerts, events)

**Files:**
- Modify: `backend/web/app.py` (add routes)
- Test: `backend/tests/test_web_reads.py`

**Interfaces:**
- Consumes: `create_app`, `get_db`, `ea.db.upsert_signal`.
- Produces: `GET /api/signals?status=<s>` → JSON list (newest first); `GET /api/tasks`, `GET /api/alerts`, `GET /api/events` → JSON lists. Each row is a dict of its columns.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_reads.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.upsert_signal(conn, type="email", source="outlook", external_ref="a",
                     title="Alpha", status="new")
    db.upsert_signal(conn, type="teams", source="teams", external_ref="b",
                     title="Bravo", status="dismissed")
    conn.close()
    return TestClient(create_app(p))


def test_signals_list_all(tmp_path):
    r = _client(tmp_path).get("/api/signals")
    assert r.status_code == 200
    titles = {row["title"] for row in r.json()}
    assert titles == {"Alpha", "Bravo"}


def test_signals_filter_status(tmp_path):
    r = _client(tmp_path).get("/api/signals", params={"status": "new"})
    body = r.json()
    assert [row["external_ref"] for row in body] == ["a"]


def test_other_tables_return_lists(tmp_path):
    c = _client(tmp_path)
    for path in ("/api/tasks", "/api/alerts", "/api/events"):
        r = c.get(path)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_reads.py -v`
Expected: FAIL — 404 on `/api/signals`

- [ ] **Step 3: Add a row helper + read routes to `backend/web/app.py`**

Add this helper near the top (after imports):
```python
def _rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]
```

Inside `create_app`, before `return app`, add:
```python
    @app.get("/api/signals")
    def list_signals(status: str | None = None, conn=Depends(get_db)):
        if status:
            return _rows(conn,
                "SELECT * FROM signals WHERE status=? ORDER BY created_at DESC, id DESC",
                (status,))
        return _rows(conn, "SELECT * FROM signals ORDER BY created_at DESC, id DESC")

    @app.get("/api/tasks")
    def list_tasks(conn=Depends(get_db)):
        return _rows(conn, "SELECT * FROM tasks ORDER BY created_at DESC, id DESC")

    @app.get("/api/alerts")
    def list_alerts(conn=Depends(get_db)):
        return _rows(conn, "SELECT * FROM alerts ORDER BY created_at DESC, id DESC")

    @app.get("/api/events")
    def list_events(conn=Depends(get_db)):
        return _rows(conn, "SELECT * FROM events ORDER BY created_at DESC, id DESC")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_web_reads.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/tests/test_web_reads.py
git commit -m "feat(web): read endpoints for signals/tasks/alerts/events"
```

---

### Task 3: Control-loop status writes

**Files:**
- Modify: `backend/web/app.py` (add POST route)
- Test: `backend/tests/test_web_control.py`

**Interfaces:**
- Consumes: `create_app`, `ea.db.update_status`.
- Produces: `POST /api/{table}/{row_id}/status` with JSON body `{"status": "<s>"}` → `{"updated": <rowcount>}`; returns 400 for a non-whitelisted table, 404 when no row matched.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_control.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.upsert_signal(conn, type="email", source="outlook", external_ref="a",
                     title="Alpha", status="new")
    conn.close()
    return TestClient(create_app(p))


def test_update_status_ok(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/signals/1/status", json={"status": "dismissed"})
    assert r.status_code == 200
    assert r.json() == {"updated": 1}
    assert c.get("/api/signals", params={"status": "new"}).json() == []


def test_update_status_unknown_table_400(tmp_path):
    r = _client(tmp_path).post("/api/people/1/status", json={"status": "x"})
    assert r.status_code == 400


def test_update_status_missing_row_404(tmp_path):
    r = _client(tmp_path).post("/api/signals/999/status", json={"status": "dismissed"})
    assert r.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_control.py -v`
Expected: FAIL — 404/405 on the POST route (not defined)

- [ ] **Step 3: Add the control route to `backend/web/app.py`**

Add near the top imports:
```python
from fastapi import HTTPException
from pydantic import BaseModel


class StatusBody(BaseModel):
    status: str
```

Inside `create_app`, before `return app`:
```python
    @app.post("/api/{table}/{row_id}/status")
    def set_status(table: str, row_id: int, body: StatusBody, conn=Depends(get_db)):
        try:
            n = db.update_status(conn, table, row_id, body.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"status not allowed on {table}")
        if n == 0:
            raise HTTPException(status_code=404, detail="row not found")
        return {"updated": n}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_web_control.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/tests/test_web_control.py
git commit -m "feat(web): control-loop status writes via update_status whitelist"
```

---

### Task 4: SSE change stream

**Files:**
- Create: `backend/web/changes.py`
- Modify: `backend/web/app.py` (add `/api/events/stream` route)
- Test: `backend/tests/test_web_changes.py`

**Interfaces:**
- Produces: `web.changes.wait_for_change(db_path, last_version, timeout=25, poll=0.2) -> int` — blocks until `data_version` differs from `last_version` (returns the new version) or `timeout` elapses (returns `last_version` unchanged). `web.changes.current_version(db_path) -> int`. Route `GET /api/events/stream` → `text/event-stream` emitting `event: db-changed` lines (wired in app.py; tested via the helper, not the stream).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_changes.py
from ea import db
from web import changes


def test_current_version_is_int(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    assert isinstance(changes.current_version(p), int)


def test_wait_returns_new_version_on_write(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    v0 = changes.current_version(p)
    writer = db.get_conn(p)
    db.upsert_signal(writer, type="email", source="outlook", external_ref="a", title="A")
    v1 = changes.wait_for_change(p, v0, timeout=2, poll=0.05)
    assert v1 != v0


def test_wait_times_out_without_write(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    v0 = changes.current_version(p)
    v1 = changes.wait_for_change(p, v0, timeout=0.3, poll=0.05)
    assert v1 == v0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_changes.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'web.changes'`

- [ ] **Step 3: Create `backend/web/changes.py`**

```python
"""DB change detection for SSE — polls PRAGMA data_version on a fresh connection."""
from __future__ import annotations
import time
from ea import db


def current_version(db_path) -> int:
    conn = db.get_conn(db_path)
    try:
        return db.data_version(conn)
    finally:
        conn.close()


def wait_for_change(db_path, last_version, timeout=25, poll=0.2) -> int:
    """Block until data_version != last_version (return new) or timeout (return last)."""
    deadline = time.monotonic() + timeout
    conn = db.get_conn(db_path)
    try:
        while time.monotonic() < deadline:
            v = db.data_version(conn)
            if v != last_version:
                return v
            time.sleep(poll)
        return last_version
    finally:
        conn.close()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_web_changes.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire the SSE route in `backend/web/app.py`**

Add imports:
```python
import json
from fastapi.responses import StreamingResponse
from web import changes
```

Inside `create_app`, before `return app`:
```python
    @app.get("/api/events/stream")
    def events_stream():
        def gen():
            last = changes.current_version(db_path)
            yield f"event: db-changed\ndata: {json.dumps({'version': last})}\n\n"
            while True:
                v = changes.wait_for_change(db_path, last, timeout=25)
                if v != last:
                    last = v
                    yield f"event: db-changed\ndata: {json.dumps({'version': v})}\n\n"
                else:
                    yield ": keep-alive\n\n"
        return StreamingResponse(gen(), media_type="text/event-stream")
```

- [ ] **Step 6: Run the full suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS (all web tests + the 14 from Plan A).

- [ ] **Step 7: Commit**

```bash
git add backend/web/changes.py backend/web/app.py backend/tests/test_web_changes.py
git commit -m "feat(web): SSE change stream via data_version polling"
```

---

## Self-Review

**Spec coverage (UI/stack spec §2):**
- FastAPI HTTP surface over EA_DB → Tasks 1-3. ✓
- Read endpoints per table → Task 2. ✓
- Control-loop status writes (whitelist) → Task 3. ✓
- SSE via `data_version` → Task 4. ✓

**Deferred to later plans:** token vault + M365 (Plan C/integration); React consumer (Plan D); feature endpoints for deadlines/trends (feature plans); CORS/CSP hardening (Plan F/polish).

**Placeholder scan:** none — every step has complete content + exact commands.

**Type consistency:** `create_app(db_path)`, `get_db`, `_rows`, `StatusBody`, `wait_for_change`, `current_version` used identically across tasks/tests.

**Note for executor:** SSE is tested via the `changes` helper, not the live HTTP stream (streaming endpoints are awkward to assert under TestClient). Do not add a flaky stream-consuming test; the helper tests cover the logic.
