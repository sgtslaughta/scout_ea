# Feature Web API Implementation Plan (Deadlines / Trends / Outlook endpoints)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Browser-facing HTTP endpoints for the feature data — deadlines (list/add/visibility), config writes (global toggle), trends (by window), and an assembled Daily Outlook snapshot. Extends the existing FastAPI app; fully TestClient-testable.

**Architecture:** New routes in `backend/web/app.py` reusing the `ea.db` feature helpers (merged). One new `ea.db.set_config` helper (whitelisted) and `ea.db.latest_trend_window`. Outlook assembly is a pure function in `backend/lib/outlook.py` (takes pre-fetched rows + `now`, returns the snapshot dict with countdowns) so it is unit-testable without HTTP or the clock.

**Tech Stack:** Python 3.11+, FastAPI, stdlib `uuid`/`datetime`, pytest + TestClient.

## Global Constraints

- All DB access via `ea.db` helpers / parameterized SQL — no string-built SQL with user input.
- Config writes restricted to an explicit whitelist (never arbitrary keys).
- Manual deadlines use `source='manual'`, `external_ref=f"manual:{uuid4()}"`.
- The web layer MAY read the wall clock (`datetime.now(timezone.utc)`) and pass it as `now` into pure `lib/` functions; `lib/` functions themselves NEVER call `datetime.now()`.
- Status codes: 400 invalid input/key, 404 missing row, 200 success.
- Files under 500 lines (split a `web/feature_routes.py` module if `app.py` would exceed it).

---

### Task 1: Deadline endpoints

**Files:**
- Modify: `backend/web/app.py`
- Test: `backend/tests/test_web_deadlines.py`

**Interfaces:**
- Consumes: `ea.db.add_deadline`, `ea.db.list_deadlines`, `ea.db.set_deadline_visible`, `lib.deadlines.countdown`.
- Produces:
  - `GET /api/deadlines` → JSON list of visible active deadlines (due_at asc), each row dict PLUS `countdown_seconds` (int, computed at request time).
  - `POST /api/deadlines` body `{title, due_at, detail?}` → creates a manual deadline; returns `{"id": <int>}`.
  - `POST /api/deadlines/{deadline_id}/visible` body `{visible: bool}` → `{"updated": n}`; 404 if no row.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_deadlines.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_post_and_list_deadline(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/deadlines",
               json={"title": "Q3 deck", "due_at": "2099-01-01T17:00:00+00:00"})
    assert r.status_code == 200
    did = r.json()["id"]
    assert did >= 1
    body = c.get("/api/deadlines").json()
    assert len(body) == 1
    assert body[0]["title"] == "Q3 deck"
    assert isinstance(body[0]["countdown_seconds"], int)
    assert body[0]["countdown_seconds"] > 0          # far-future due date


def test_visibility_toggle_hides_from_list(tmp_path):
    c = _client(tmp_path)
    did = c.post("/api/deadlines",
                 json={"title": "X", "due_at": "2099-01-01T17:00:00+00:00"}).json()["id"]
    assert c.post(f"/api/deadlines/{did}/visible", json={"visible": False}).json() == {"updated": 1}
    assert c.get("/api/deadlines").json() == []
    assert c.post(f"/api/deadlines/{did}/visible", json={"visible": True}).json() == {"updated": 1}
    assert len(c.get("/api/deadlines").json()) == 1


def test_visibility_missing_row_404(tmp_path):
    r = _client(tmp_path).post("/api/deadlines/999/visible", json={"visible": False})
    assert r.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_deadlines.py -v`
Expected: FAIL — 404 on `/api/deadlines`.

- [ ] **Step 3: Add imports + models + routes to `backend/web/app.py`**

Add near the top imports:
```python
import uuid
from datetime import datetime, timezone
from lib import deadlines as _deadlines


class DeadlineBody(BaseModel):
    title: str
    due_at: str
    detail: str | None = None


class VisibleBody(BaseModel):
    visible: bool
```

Inside `create_app`, before `return app`:
```python
    @app.get("/api/deadlines")
    def list_deadlines(conn=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        out = []
        for r in db.list_deadlines(conn):
            d = dict(r)
            d["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
            out.append(d)
        return out

    @app.post("/api/deadlines")
    def add_deadline(body: DeadlineBody, conn=Depends(get_db)):
        ext = f"manual:{uuid.uuid4()}"
        db.add_deadline(conn, title=body.title, due_at=body.due_at, detail=body.detail,
                        source="manual", external_ref=ext)
        row = conn.execute("SELECT id FROM critical_deadlines WHERE external_ref=?",
                           (ext,)).fetchone()
        return {"id": row["id"]}

    @app.post("/api/deadlines/{deadline_id}/visible")
    def set_visible(deadline_id: int, body: VisibleBody, conn=Depends(get_db)):
        n = db.set_deadline_visible(conn, deadline_id, body.visible)
        if n == 0:
            raise HTTPException(status_code=404, detail="deadline not found")
        return {"updated": n}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_web_deadlines.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/tests/test_web_deadlines.py
git commit -m "feat(web): deadline endpoints — list w/ countdown, add manual, visibility toggle"
```

---

### Task 2: Config write endpoint (global toggle + settings)

**Files:**
- Modify: `backend/ea/db.py` (add `set_config`)
- Modify: `backend/web/app.py` (add route)
- Test: `backend/tests/test_web_config.py`

**Interfaces:**
- Produces:
  - `ea.db.set_config(conn, key, value) -> None` — only keys in `ea.db.WRITABLE_CONFIG` (`{'deadlines_visible_global','outlook_send_time','trend_window_days'}`); raises `ValueError` otherwise; upserts into `config`.
  - `POST /api/config/{key}` body `{value: str}` → `{"key": key, "value": value}`; 400 if key not writable.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_config.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_set_writable_config(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/config/deadlines_visible_global", json={"value": "0"})
    assert r.status_code == 200
    assert c.get("/api/config").json()["deadlines_visible_global"] == "0"


def test_set_unwritable_config_400(tmp_path):
    r = _client(tmp_path).post("/api/config/db_path", json={"value": "/etc/x"})
    assert r.status_code == 400


def test_global_toggle_hides_deadlines(tmp_path):
    c = _client(tmp_path)
    c.post("/api/deadlines", json={"title": "X", "due_at": "2099-01-01T17:00:00+00:00"})
    c.post("/api/config/deadlines_visible_global", json={"value": "0"})
    assert c.get("/api/deadlines").json() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_config.py -v`
Expected: FAIL — 404/405 on the POST.

- [ ] **Step 3: Add `set_config` to `backend/ea/db.py`**

```python
WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days"}


def set_config(conn, key, value) -> None:
    """Upsert a writable config key. Raises ValueError for non-whitelisted keys."""
    if key not in WRITABLE_CONFIG:
        raise ValueError(f"config key not writable: {key}")
    conn.execute(
        "INSERT INTO config(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, str(value)),
    )
    conn.commit()
```

- [ ] **Step 4: Add the route to `backend/web/app.py`**

Add a model near the others:
```python
class ConfigBody(BaseModel):
    value: str
```
Inside `create_app`, before `return app`:
```python
    @app.post("/api/config/{key}")
    def set_config(key: str, body: ConfigBody, conn=Depends(get_db)):
        try:
            db.set_config(conn, key, body.value)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"config key not writable: {key}")
        return {"key": key, "value": body.value}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_web_config.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/ea/db.py backend/web/app.py backend/tests/test_web_config.py
git commit -m "feat(web): writable config endpoint (whitelisted) for global toggle + settings"
```

---

### Task 3: Trend endpoints

**Files:**
- Modify: `backend/ea/db.py` (add `latest_trend_window`)
- Modify: `backend/web/app.py` (add routes)
- Test: `backend/tests/test_web_trends.py`

**Interfaces:**
- Produces:
  - `ea.db.latest_trend_window(conn) -> str | None` — the max `window_start`, or None if no trends.
  - `GET /api/trends?window_start=<w>` → ranked list for that window; if `window_start` omitted, uses the latest window (empty list if none).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_trends.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.upsert_trend(conn, term="old", kind="keyword",
                    window_start="2026-06-07", window_end="2026-06-14", score=1.0)
    db.upsert_trend(conn, term="newA", kind="keyword",
                    window_start="2026-06-14", window_end="2026-06-21", score=2.0)
    db.upsert_trend(conn, term="newB", kind="keyword",
                    window_start="2026-06-14", window_end="2026-06-21", score=5.0)
    conn.close()
    return TestClient(create_app(p))


def test_trends_latest_window_default(tmp_path):
    body = _client(tmp_path).get("/api/trends").json()
    # latest window is 2026-06-14; ranked by score desc
    assert [t["term"] for t in body] == ["newB", "newA"]


def test_trends_explicit_window(tmp_path):
    body = _client(tmp_path).get("/api/trends", params={"window_start": "2026-06-07"}).json()
    assert [t["term"] for t in body] == ["old"]


def test_trends_empty_when_none(tmp_path):
    p = tmp_path / "empty.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    assert TestClient(create_app(p)).get("/api/trends").json() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_trends.py -v`
Expected: FAIL — 404 on `/api/trends`.

- [ ] **Step 3: Add `latest_trend_window` to `backend/ea/db.py`**

```python
def latest_trend_window(conn):
    """Return the most recent window_start present in trends, or None."""
    row = conn.execute("SELECT MAX(window_start) AS w FROM trends").fetchone()
    return row["w"] if row and row["w"] is not None else None
```

- [ ] **Step 4: Add the route to `backend/web/app.py`**

Inside `create_app`, before `return app`:
```python
    @app.get("/api/trends")
    def list_trends(window_start: str | None = None, conn=Depends(get_db)):
        w = window_start or db.latest_trend_window(conn)
        if w is None:
            return []
        return [dict(r) for r in db.list_trends(conn, w)]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_web_trends.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/ea/db.py backend/web/app.py backend/tests/test_web_trends.py
git commit -m "feat(web): trends endpoint — ranked list for a window (defaults to latest)"
```

---

### Task 4: Daily Outlook aggregation

**Files:**
- Create: `backend/lib/outlook.py`
- Modify: `backend/web/app.py` (add `/api/outlook` route)
- Test: `backend/tests/test_lib_outlook.py`, `backend/tests/test_web_outlook.py`

**Interfaces:**
- Produces:
  - `lib.outlook.assemble(now, deadlines, trends, proactive, tasks) -> dict` — pure. `deadlines`/`trends`/`proactive`/`tasks` are lists of dicts (already fetched). Returns:
    ```
    {"date": "YYYY-MM-DD",
     "deadlines": [ {..deadline.., "countdown_seconds": int} ],
     "top_trends": [ up to 5 trend dicts by given order ],
     "proactive": [ ...proactive signal dicts ],
     "tasks_due_today": [ tasks whose due_at date == today ]}
    ```
    `today` is derived from `now` (UTC date). `countdown_seconds` via `lib.deadlines.countdown`.
  - `GET /api/outlook` → fetches the rows and returns `assemble(...)`.

- [ ] **Step 1: Write the failing pure-logic test**

```python
# backend/tests/test_lib_outlook.py
from lib import outlook

NOW = "2026-06-21T09:00:00+00:00"


def test_assemble_shapes_and_countdown():
    deadlines = [{"id": 1, "title": "D", "due_at": "2026-06-21T17:00:00+00:00"}]
    trends = [{"term": f"t{i}", "score": float(i)} for i in range(7)]
    proactive = [{"id": 9, "title": "send card", "type": "proactive"}]
    tasks = [
        {"id": 1, "title": "today", "due_at": "2026-06-21T12:00:00+00:00"},
        {"id": 2, "title": "tomorrow", "due_at": "2026-06-22T12:00:00+00:00"},
    ]
    out = outlook.assemble(NOW, deadlines, trends, proactive, tasks)
    assert out["date"] == "2026-06-21"
    assert out["deadlines"][0]["countdown_seconds"] == 8 * 3600
    assert len(out["top_trends"]) == 5                      # capped at 5
    assert out["proactive"][0]["title"] == "send card"
    assert [t["id"] for t in out["tasks_due_today"]] == [1] # only today's task
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_lib_outlook.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.outlook'`

- [ ] **Step 3: Create `backend/lib/outlook.py`**

```python
"""Daily Outlook assembly — pure: takes fetched rows + now, returns the snapshot."""
from __future__ import annotations
from lib import deadlines as _deadlines


def _date(iso: str) -> str:
    return iso[:10]  # YYYY-MM-DD prefix of an ISO-8601 string


def assemble(now, deadlines, trends, proactive, tasks):
    today = _date(now)
    dl = []
    for d in deadlines:
        row = dict(d)
        row["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
        dl.append(row)
    tasks_today = [dict(t) for t in tasks if t.get("due_at") and _date(t["due_at"]) == today]
    return {
        "date": today,
        "deadlines": dl,
        "top_trends": [dict(t) for t in trends[:5]],
        "proactive": [dict(p) for p in proactive],
        "tasks_due_today": tasks_today,
    }
```

- [ ] **Step 4: Run the logic test to verify it passes**

Run: `cd backend && python -m pytest tests/test_lib_outlook.py -v`
Expected: PASS (1 test)

- [ ] **Step 5: Write the endpoint test**

```python
# backend/tests/test_web_outlook.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.add_deadline(conn, title="D", due_at="2099-01-01T17:00:00+00:00",
                    source="email", external_ref="d1")
    db.upsert_signal(conn, type="proactive", source="outlook", external_ref="p1",
                     title="send card", status="new")
    conn.close()
    return TestClient(create_app(p))


def test_outlook_endpoint(tmp_path):
    body = _client(tmp_path).get("/api/outlook").json()
    assert "date" in body
    assert body["deadlines"][0]["title"] == "D"
    assert body["deadlines"][0]["countdown_seconds"] > 0
    assert any(p["title"] == "send card" for p in body["proactive"])
```

- [ ] **Step 6: Add the `/api/outlook` route to `backend/web/app.py`**

Add import:
```python
from lib import outlook as _outlook
```
Inside `create_app`, before `return app`:
```python
    @app.get("/api/outlook")
    def get_outlook(conn=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        deadlines = [dict(r) for r in db.list_deadlines(conn)]
        w = db.latest_trend_window(conn)
        trends = [dict(r) for r in db.list_trends(conn, w)] if w else []
        proactive = [dict(r) for r in conn.execute(
            "SELECT * FROM signals WHERE type='proactive' AND status='new' "
            "ORDER BY created_at DESC")]
        tasks = [dict(r) for r in conn.execute(
            "SELECT * FROM tasks WHERE status IN ('open','in_progress')")]
        return _outlook.assemble(now, deadlines, trends, proactive, tasks)
```

- [ ] **Step 7: Run the full suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS (all prior + new outlook tests).

- [ ] **Step 8: Commit**

```bash
git add backend/lib/outlook.py backend/web/app.py backend/tests/test_lib_outlook.py backend/tests/test_web_outlook.py
git commit -m "feat(web): Daily Outlook aggregation endpoint + pure assembler"
```

---

## Self-Review

**Spec coverage (UI/feature spec — browser API surface):**
- Deadlines list w/ countdown + add manual + per-row visibility → Task 1. ✓
- Global deadline toggle + writable settings → Task 2. ✓
- Trends by window (default latest) → Task 3. ✓
- Daily Outlook snapshot (deadlines/trends/proactive/tasks-today) → Task 4. ✓

**Deferred (correctly absent):** LLM proactive-suggestion generation (daily_outlook skill writes the proactive signals; this endpoint only reads them); vector "related trends"; React UI; auth.

**Placeholder scan:** none — complete code + exact commands.

**Type consistency:** `set_config`/`WRITABLE_CONFIG`/`latest_trend_window`/`assemble`/`DeadlineBody`/`VisibleBody`/`ConfigBody` consistent across tasks and tests. `assemble(now, deadlines, trends, proactive, tasks)` argument order is identical in `lib/outlook.py`, its test, and the endpoint.

**Note for executor:** the web layer reads `datetime.now(timezone.utc)` and passes it INTO pure `lib` functions — never add `datetime.now()` inside `lib/`. The outlook test uses far-future due dates so countdowns stay positive regardless of when the suite runs.
