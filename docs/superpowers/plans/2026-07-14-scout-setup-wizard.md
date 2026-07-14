# Scout Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the schedule-driven Skills grid with a 3-step Setup Wizard (connect MCP → add skills → add automations) that guides a beginner through configuring Scout, with click-to-copy everywhere and live connection validation.

**Architecture:** A new frontend `SetupWizard` (MUI Stepper) talks to the web API (:8765). It persists the user-chosen MCP name in the existing `config` kv table, reads MCP connection details (URL + token) from a new endpoint, and validates connectivity by polling a "last-seen" timestamp that the MCP server's auth middleware (:8766) stamps into the shared SQLite DB on each authenticated call. Skill bodies carry a `{{mcp_name}}` token rendered client-side before copy.

**Tech Stack:** Python (FastAPI, Starlette middleware, sqlite3), FastMCP; React + TypeScript + MUI v7 (Stepper), Vitest/RTL; pytest.

## Global Constraints

- Keep files under 500 lines where possible; `SetupWizard.tsx` may split into per-step subcomponents if it grows past that.
- Frontend build verification = `npm run build` (tsc -b, strict), not `tsc --noEmit`.
- All Scout interaction is copy-paste; the wizard never drives Scout.
- MCP name default = `scout-ea`. URL path is always `/mcp`. Frequency values are natural-language strings.
- Token exposure via `/api/mcp/config` is deliberate and localhost-scoped; mark with a `ponytail:` comment.
- Backend tests: pytest under `backend/`. Frontend tests: vitest under `frontend/`.
- Semantic commits.

---

### Task 1: Whitelist wizard config keys

**Files:**
- Modify: `backend/ea/db.py:591-597` (`WRITABLE_CONFIG` set)
- Test: `backend/tests/test_config_writable.py` (create)

**Interfaces:**
- Produces: config keys `mcp_name`, `wizard_done`, `mcp_last_seen` are writable via `db.set_config(conn, key, value)` and `POST /api/config/{key}`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_config_writable.py
import sqlite3
from ea import db

def _mem():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE config(key TEXT PRIMARY KEY, value TEXT)")
    return conn

def test_wizard_keys_writable():
    conn = _mem()
    for k in ("mcp_name", "wizard_done", "mcp_last_seen"):
        db.set_config(conn, k, "x")
        row = conn.execute("SELECT value FROM config WHERE key=?", (k,)).fetchone()
        assert row["value"] == "x"

def test_unknown_key_still_rejected():
    conn = _mem()
    try:
        db.set_config(conn, "not_a_key", "x")
        assert False, "expected ValueError"
    except ValueError:
        pass
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_config_writable.py -v`
Expected: FAIL on `test_wizard_keys_writable` (ValueError: config key not writable: mcp_name)

- [ ] **Step 3: Add the keys**

In `backend/ea/db.py`, extend the `WRITABLE_CONFIG` set with the three keys:

```python
                   "finance_watchlist",
                   # wizard: user-chosen MCP name, completion flag, MCP last-seen stamp
                   "mcp_name", "wizard_done", "mcp_last_seen"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_config_writable.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_config_writable.py
git commit -m "feat(config): whitelist mcp_name, wizard_done, mcp_last_seen"
```

---

### Task 2: `GET /api/mcp/config` endpoint

**Files:**
- Modify: `backend/web/app.py` (add endpoint near `get_config` ~line 187; add `import os` at top if absent)
- Modify: `docker-compose.yml:8-11` (web service `environment`)
- Test: `backend/tests/test_mcp_config_endpoint.py` (create)

**Interfaces:**
- Produces: `GET /api/mcp/config` → `{"url": str, "token": str, "configured": bool}`. `url` = `http://{EA_MCP_PUBLIC_HOST|localhost}:{EA_MCP_PORT|8766}/mcp`; `token` = `EA_MCP_TOKEN` env (empty string if unset); `configured` = `bool(token)`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_mcp_config_endpoint.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app

def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))

def test_mcp_config_returns_url_and_token(tmp_path, monkeypatch):
    monkeypatch.setenv("EA_MCP_TOKEN", "abc123")
    monkeypatch.setenv("EA_MCP_PORT", "8766")
    r = _client(tmp_path).get("/api/mcp/config")
    assert r.status_code == 200
    body = r.json()
    assert body["url"].endswith(":8766/mcp")
    assert body["token"] == "abc123"
    assert body["configured"] is True

def test_mcp_config_unset_token(tmp_path, monkeypatch):
    monkeypatch.delenv("EA_MCP_TOKEN", raising=False)
    body = _client(tmp_path).get("/api/mcp/config").json()
    assert body["token"] == ""
    assert body["configured"] is False
```

> Env vars are read inside the endpoint at request time, so `monkeypatch.setenv` works even though `create_app` was already built. Fixture pattern copied from `backend/tests/test_web_config.py`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_config_endpoint.py -v`
Expected: FAIL (404 on `/api/mcp/config`)

- [ ] **Step 3: Add the endpoint**

At the top of `backend/web/app.py` ensure `import os` is present. Add inside the app factory, next to `get_config`:

```python
    @app.get("/api/mcp/config")
    def get_mcp_config():
        # ponytail: token shown to the authenticated local dashboard user on
        # purpose — they must paste it into Scout's MCP dialog. Localhost-scoped.
        token = os.environ.get("EA_MCP_TOKEN", "")
        host = os.environ.get("EA_MCP_PUBLIC_HOST", "localhost")
        port = os.environ.get("EA_MCP_PORT", "8766")
        return {"url": f"http://{host}:{port}/mcp", "token": token,
                "configured": bool(token)}
```

- [ ] **Step 4: Wire env into the web container**

In `docker-compose.yml`, under `services.web.environment`, add:

```yaml
      EA_MCP_PORT: 8766
      EA_MCP_TOKEN: ${EA_MCP_TOKEN}
      EA_MCP_PUBLIC_HOST: ${EA_MCP_PUBLIC_HOST:-localhost}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mcp_config_endpoint.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/web/app.py backend/tests/test_mcp_config_endpoint.py docker-compose.yml
git commit -m "feat(api): GET /api/mcp/config exposes MCP url + token for wizard"
```

---

### Task 3: `GET /api/mcp/status` endpoint

**Files:**
- Modify: `backend/web/app.py` (add endpoint near `get_config`)
- Test: `backend/tests/test_mcp_status_endpoint.py` (create)

**Interfaces:**
- Consumes: `config['mcp_last_seen']` (written by Task 4).
- Produces: `GET /api/mcp/status` → `{"last_seen": str | None}` — the value of `config['mcp_last_seen']`, or `null` if absent.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_mcp_status_endpoint.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app

def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))

def test_status_null_before_any_call(tmp_path):
    c = _client(tmp_path)
    assert c.get("/api/mcp/status").json()["last_seen"] is None

def test_status_returns_stamp(tmp_path):
    c = _client(tmp_path)
    # mcp_last_seen is writable (Task 1), so this also exercises the whitelist
    c.post("/api/config/mcp_last_seen", json={"value": "2026-07-14T00:00:00+00:00"})
    assert c.get("/api/mcp/status").json()["last_seen"] == "2026-07-14T00:00:00+00:00"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mcp_status_endpoint.py -v`
Expected: FAIL (404)

- [ ] **Step 3: Add the endpoint**

In `backend/web/app.py`, next to `get_config`:

```python
    @app.get("/api/mcp/status")
    def get_mcp_status(conn=Depends(get_db)):
        row = conn.execute("SELECT value FROM config WHERE key='mcp_last_seen'").fetchone()
        return {"last_seen": row["value"] if row else None}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mcp_status_endpoint.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/tests/test_mcp_status_endpoint.py
git commit -m "feat(api): GET /api/mcp/status returns MCP last-seen timestamp"
```

---

### Task 4: MCP middleware stamps `mcp_last_seen`

**Files:**
- Modify: `backend/mcp_server/auth.py` (extend `BearerAuthMiddleware`)
- Modify: `backend/mcp_server/server.py:416-419` (`http_app` passes `db_path`)
- Test: `backend/tests/test_auth_stamp.py` (create)

**Interfaces:**
- Consumes: `db.get_conn(db_path)`, `db.set_config(conn, "mcp_last_seen", iso)` (Task 1).
- Produces: on each **authenticated** MCP request, `config['mcp_last_seen']` is set to a UTC ISO8601 string; unauthenticated (401) requests do not stamp.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_auth_stamp.py
import sqlite3
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient
from mcp_server.auth import BearerAuthMiddleware
from ea import db

def _app(db_path):
    async def ok(request): return PlainTextResponse("ok")
    app = Starlette(routes=[Route("/mcp", ok, methods=["GET", "POST"])])
    app.add_middleware(BearerAuthMiddleware, token="secret", db_path=db_path)
    return app

def _fresh_db(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.get_conn(p)
    conn.execute("CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT)")
    conn.commit()
    return p

def test_authed_request_stamps(tmp_path):
    p = _fresh_db(tmp_path)
    c = TestClient(_app(p))
    assert c.get("/mcp", headers={"authorization": "Bearer secret"}).status_code == 200
    row = db.get_conn(p).execute("SELECT value FROM config WHERE key='mcp_last_seen'").fetchone()
    assert row and row[0]

def test_unauthed_request_does_not_stamp(tmp_path):
    p = _fresh_db(tmp_path)
    c = TestClient(_app(p))
    assert c.get("/mcp", headers={"authorization": "Bearer wrong"}).status_code == 401
    row = db.get_conn(p).execute("SELECT value FROM config WHERE key='mcp_last_seen'").fetchone()
    assert row is None
```

> Confirm `db.get_conn` signature accepts a path: `rg -n "def get_conn" backend/ea/db.py`. Adjust the fixture if it needs schema init beyond `config`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_auth_stamp.py -v`
Expected: FAIL (`__init__` got unexpected kwarg `db_path`, or no stamp written)

- [ ] **Step 3: Implement stamping**

Rewrite `backend/mcp_server/auth.py`:

```python
"""Bearer-token gate for the MCP server's HTTP transport (loopback, single shared token)."""
from __future__ import annotations
import hmac
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from ea import db


class BearerAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, token, db_path=None):
        super().__init__(app)
        self._expected = f"Bearer {token}"
        self._db_path = db_path

    async def dispatch(self, request, call_next):
        provided = request.headers.get("authorization", "") or ""
        if not hmac.compare_digest(provided, self._expected):
            return JSONResponse({"detail": "unauthorized"}, status_code=401)
        self._stamp()
        return await call_next(request)

    def _stamp(self):
        # ponytail: best-effort last-seen for the wizard's connection check;
        # never let a bookkeeping write break an MCP request.
        if not self._db_path:
            return
        try:
            conn = db.get_conn(self._db_path)
            db.set_config(conn, "mcp_last_seen", datetime.now(timezone.utc).isoformat())
        except Exception:
            pass
```

Then in `backend/mcp_server/server.py`, update `http_app`:

```python
def http_app(db_path, token, skills_dir=None):
    """Return the bearer-gated streamable-http ASGI app for this server."""
    app = build_server(db_path, skills_dir=skills_dir).streamable_http_app()
    app.add_middleware(BearerAuthMiddleware, token=token, db_path=db_path)
    return app
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_auth_stamp.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && python -m pytest -q`
Expected: all pass (no regression from the middleware signature change)

- [ ] **Step 6: Commit**

```bash
git add backend/mcp_server/auth.py backend/mcp_server/server.py backend/tests/test_auth_stamp.py
git commit -m "feat(mcp): stamp mcp_last_seen on each authed request for wizard validation"
```

---

### Task 5: Frontend API fetchers

**Files:**
- Modify: `frontend/src/api.ts` (add types + fetchers; `setConfig`, `getConfig`, `getSkills` already exist)
- Test: `frontend/src/api.mcp.test.ts` (create)

**Interfaces:**
- Produces:
  - `interface McpConfig { url: string; token: string; configured: boolean }`
  - `interface McpStatus { last_seen: string | null }`
  - `getMcpConfig(): Promise<McpConfig>` → `GET /api/mcp/config`
  - `getMcpStatus(): Promise<McpStatus>` → `GET /api/mcp/status`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/api.mcp.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getMcpConfig, getMcpStatus } from './api'

afterEach(() => vi.restoreAllMocks())

function mockFetch(json: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200, statusText: 'OK', json: async () => json,
  }))
}

describe('mcp api', () => {
  it('getMcpConfig hits /api/mcp/config', async () => {
    mockFetch({ url: 'http://localhost:8766/mcp', token: 't', configured: true })
    const c = await getMcpConfig()
    expect(c.url).toContain('/mcp')
    expect(fetch).toHaveBeenCalledWith('/api/mcp/config')
  })
  it('getMcpStatus returns last_seen', async () => {
    mockFetch({ last_seen: null })
    expect((await getMcpStatus()).last_seen).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/api.mcp.test.ts`
Expected: FAIL (getMcpConfig is not exported)

- [ ] **Step 3: Add types + fetchers**

In `frontend/src/api.ts` (near the other interfaces and `getConfig`):

```ts
export interface McpConfig {
  url: string
  token: string
  configured: boolean
}
export interface McpStatus {
  last_seen: string | null
}

export const getMcpConfig = () => fetchJson<McpConfig>('/api/mcp/config')
export const getMcpStatus = () => fetchJson<McpStatus>('/api/mcp/status')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/api.mcp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.mcp.test.ts
git commit -m "feat(api): getMcpConfig + getMcpStatus fetchers"
```

---

### Task 6: Wizard shell (Stepper) + mount in Automations

**Files:**
- Create: `frontend/src/views/SetupWizard.tsx`
- Modify: `frontend/src/views/Automations.tsx`
- Test: `frontend/src/views/SetupWizard.test.tsx` (create)

**Interfaces:**
- Produces: `export function SetupWizard()` — an MUI `Stepper` with three steps labelled "Connect", "Skills", "Automations", Back/Next navigation. Steps 7–9 fill each step body; this task ships the shell with placeholder step bodies (`<Step1Connect/>` etc. as empty typed components in the same file, replaced by later tasks).
- Consumes: nothing yet.
- Automations tab order becomes: `Setup` (SetupWizard, default) → `Skills` (existing grid/inspect) → `Activity`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/views/SetupWizard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SetupWizard } from './SetupWizard'

describe('SetupWizard', () => {
  it('shows three step labels', () => {
    render(<SetupWizard />)
    expect(screen.getByText('Connect')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toBeInTheDocument()
  })
  it('advances with Next', () => {
    render(<SetupWizard />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    // step index moves; Back becomes enabled
    expect(screen.getByRole('button', { name: /back/i })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/SetupWizard.test.tsx`
Expected: FAIL (Cannot find module ./SetupWizard)

- [ ] **Step 3: Implement the shell**

```tsx
// frontend/src/views/SetupWizard.tsx
import { useState } from 'react'
import { Box, Stepper, Step, StepLabel, Button, Stack } from '@mui/material'

const STEPS = ['Connect', 'Skills', 'Automations']

export function SetupWizard() {
  const [active, setActive] = useState(0)
  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', p: 2 }}>
      <Stepper activeStep={active} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>
      <Box sx={{ minHeight: 200 }}>
        {active === 0 && <Step1Connect />}
        {active === 1 && <Step2Skills />}
        {active === 2 && <Step3Automations />}
      </Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
        <Button disabled={active === 0} onClick={() => setActive((s) => s - 1)}>Back</Button>
        <Button variant="contained" disabled={active === STEPS.length - 1}
                onClick={() => setActive((s) => s + 1)}>Next</Button>
      </Stack>
    </Box>
  )
}

// Placeholder step bodies — filled by Tasks 7–9.
function Step1Connect() { return <div>Connect step</div> }
function Step2Skills() { return <div>Skills step</div> }
function Step3Automations() { return <div>Automations step</div> }
```

- [ ] **Step 4: Mount it as the first Automations tab**

In `frontend/src/views/Automations.tsx`:

```tsx
import { lazy } from 'react'
import { TabbedView } from '@/components/TabbedView'

const SetupWizard = lazy(() => import('./SetupWizard').then((m) => ({ default: m.SetupWizard })))
const SkillsView = lazy(() => import('./Skills').then((m) => ({ default: m.SkillsView })))
const ActivityView = lazy(() => import('./Activity').then((m) => ({ default: m.ActivityView })))

export function AutomationsView() {
  return (
    <TabbedView
      ariaLabel="Automations sections"
      tabs={[
        { id: 'setup', label: 'Setup', element: <SetupWizard /> },
        { id: 'skills', label: 'Skills', element: <SkillsView /> },
        { id: 'activity', label: 'Activity', element: <ActivityView /> },
      ]}
    />
  )
}
```

- [ ] **Step 5: Run test + build**

Run: `cd frontend && npx vitest run src/views/SetupWizard.test.tsx && npm run build`
Expected: test PASS; build succeeds (tsc -b strict)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/SetupWizard.tsx frontend/src/views/SetupWizard.test.tsx frontend/src/views/Automations.tsx
git commit -m "feat(wizard): stepper shell mounted as first Automations tab"
```

---

### Task 7: Step 1 — Connect the MCP

**Files:**
- Modify: `frontend/src/views/SetupWizard.tsx` (replace `Step1Connect`)
- Test: `frontend/src/views/SetupWizard.step1.test.tsx` (create)

**Interfaces:**
- Consumes: `getMcpConfig`, `getConfig`, `setConfig`, `getMcpStatus` from `api.ts`.
- Produces: `Step1Connect` renders a name field (persists `mcp_name` on blur/change via `setConfig`), copy-URL + copy-token buttons, and a Validate panel that polls `getMcpStatus` and shows success once `last_seen` advances past the moment the panel mounted.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/views/SetupWizard.step1.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './../api'
import { SetupWizard } from './SetupWizard'

beforeEach(() => {
  vi.spyOn(api, 'getMcpConfig').mockResolvedValue({ url: 'http://localhost:8766/mcp', token: 'tok', configured: true })
  vi.spyOn(api, 'getConfig').mockResolvedValue({ mcp_name: 'scout-ea' })
  vi.spyOn(api, 'setConfig').mockResolvedValue({ key: 'mcp_name', value: 'x' })
  vi.spyOn(api, 'getMcpStatus').mockResolvedValue({ last_seen: null })
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('Step 1 Connect', () => {
  it('renders MCP url and persists a renamed connection', async () => {
    render(<SetupWizard />)
    expect(await screen.findByDisplayValue('scout-ea')).toBeInTheDocument()
    const field = screen.getByLabelText(/connection name/i)
    fireEvent.change(field, { target: { value: 'my-scout' } })
    fireEvent.blur(field)
    await waitFor(() => expect(api.setConfig).toHaveBeenCalledWith('mcp_name', 'my-scout'))
  })
  it('copies the token', async () => {
    render(<SetupWizard />)
    fireEvent.click(await screen.findByRole('button', { name: /copy token/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('tok'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/SetupWizard.step1.test.tsx`
Expected: FAIL (no name field / copy button)

- [ ] **Step 3: Implement Step1Connect**

Replace the `Step1Connect` placeholder in `SetupWizard.tsx`. Lift the MCP name into `SetupWizard` state so Steps 2–3 can read it — pass `name`/`onName` props down. Implementation:

```tsx
import { useEffect, useState } from 'react'
import {
  Box, Stepper, Step, StepLabel, Button, Stack, TextField, Typography,
  Paper, IconButton, Alert, CircularProgress,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import {
  getMcpConfig, getConfig, setConfig, getMcpStatus, type McpConfig,
} from '../api'

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 1 }}>
      <Typography variant="caption" sx={{ minWidth: 96, color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>{value}</Typography>
      <IconButton size="small" aria-label={`copy ${label}`}
        onClick={() => navigator.clipboard.writeText(value)}>
        <ContentCopyIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
}

function Step1Connect({ name, onName }: { name: string; onName: (n: string) => void }) {
  const [cfg, setCfg] = useState<McpConfig | null>(null)
  const [openedAt, setOpenedAt] = useState<string>('')
  const [connected, setConnected] = useState(false)

  useEffect(() => { getMcpConfig().then(setCfg) }, [])
  useEffect(() => { setOpenedAt(new Date().toISOString()) }, [])
  useEffect(() => {
    if (connected) return
    const t = setInterval(async () => {
      const { last_seen } = await getMcpStatus()
      if (last_seen && openedAt && last_seen > openedAt) setConnected(true)
    }, 3000)
    return () => clearInterval(t)
  }, [connected, openedAt])

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        An MCP connection lets Scout use this assistant's tools. Name it, then paste the address
        and token into Scout's <b>Add MCP server</b> dialog.
      </Typography>
      <TextField label="Connection name" size="small" value={name}
        onChange={(e) => onName(e.target.value)}
        onBlur={() => setConfig('mcp_name', name)} sx={{ maxWidth: 320 }} />
      <CopyRow label="Address" value={cfg?.url ?? ''} />
      {cfg?.configured
        ? <CopyRow label="Auth token" value={cfg.token} />
        : <Alert severity="warning">Server token not set (EA_MCP_TOKEN). Set it, then reload.</Alert>}
      <Box>
        <Typography variant="subtitle2">Check the connection</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          In Scout, send this message, then wait for the check to turn green:
        </Typography>
        <CopyRow label="Ask Scout" value="List your available tools" />
        {connected
          ? <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success">Scout reached your MCP.</Alert>
          : <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
              <CircularProgress size={16} /><Typography variant="body2">Waiting for Scout…</Typography>
            </Stack>}
      </Box>
    </Stack>
  )
}
```

Update `SetupWizard` to own the name and load it once:

```tsx
export function SetupWizard() {
  const [active, setActive] = useState(0)
  const [name, setName] = useState('scout-ea')
  useEffect(() => { getConfig().then((c) => { if (c.mcp_name) setName(c.mcp_name) }) }, [])
  // ...stepper unchanged...
        {active === 0 && <Step1Connect name={name} onName={setName} />}
        {active === 1 && <Step2Skills mcpName={name} />}
        {active === 2 && <Step3Automations />}
  // ...
}
```

> `new Date().toISOString()` here is fine — this is app runtime, not a workflow script.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/views/SetupWizard.step1.test.tsx src/views/SetupWizard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/SetupWizard.tsx frontend/src/views/SetupWizard.step1.test.tsx
git commit -m "feat(wizard): step 1 connect MCP — name, copy url/token, live validate"
```

---

### Task 8: Step 2 — Add Skills (hidden body + name templating)

**Files:**
- Modify: `frontend/src/views/SetupWizard.tsx` (replace `Step2Skills`)
- Test: `frontend/src/views/SetupWizard.step2.test.tsx` (create)

**Interfaces:**
- Consumes: `getSkills` from `api.ts`; `mcpName` prop from `SetupWizard`.
- Produces: `Step2Skills({ mcpName })` lists skills as cards (name + description + Copy + View). Body hidden by default; **View** toggles an MUI `Collapse`. Copy writes the body with every `{{mcp_name}}` replaced by `mcpName`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/views/SetupWizard.step2.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './../api'
import { SetupWizard } from './SetupWizard'

beforeEach(() => {
  vi.spyOn(api, 'getMcpConfig').mockResolvedValue({ url: 'u', token: 't', configured: true })
  vi.spyOn(api, 'getConfig').mockResolvedValue({ mcp_name: 'my-scout' })
  vi.spyOn(api, 'getMcpStatus').mockResolvedValue({ last_seen: null })
  vi.spyOn(api, 'getSkills').mockResolvedValue([
    { name: 'triage_email', description: 'Triage inbox', body: 'Use the {{mcp_name}} MCP server.' },
  ])
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

async function goToSkills() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByRole('button', { name: /next/i }))
}

describe('Step 2 Skills', () => {
  it('hides body until View and copies with name substituted', async () => {
    await goToSkills()
    expect(await screen.findByText('triage_email')).toBeInTheDocument()
    expect(screen.queryByText(/MCP server\./)).not.toBeInTheDocument()  // body hidden
    fireEvent.click(screen.getByRole('button', { name: /view/i }))
    expect(await screen.findByText(/my-scout MCP server\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Use the my-scout MCP server.'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/SetupWizard.step2.test.tsx`
Expected: FAIL (skills not listed / body visible)

- [ ] **Step 3: Implement Step2Skills**

Add imports (`Card, CardContent, Collapse` from `@mui/material`, `useEffect/useState`, `getSkills, type Skill`). Replace the placeholder:

```tsx
function renderBody(body: string, mcpName: string) {
  return body.split('{{mcp_name}}').join(mcpName)
}

function Step2Skills({ mcpName }: { mcpName: string }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  useEffect(() => { getSkills().then(setSkills) }, [])
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        A skill is a set of instructions Scout follows. For each one, click <b>Copy</b> and paste it
        into a new Skill in Scout.
      </Typography>
      {skills.map((s) => (
        <Card key={s.name} variant="outlined">
          <CardContent sx={{ py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>{s.name}</Typography>
                <Typography variant="caption" color="text.secondary">{s.description}</Typography>
              </Box>
              <Button size="small" onClick={() => setOpen((o) => ({ ...o, [s.name]: !o[s.name] }))}>
                {open[s.name] ? 'Hide' : 'View'}
              </Button>
              <Button size="small" variant="contained"
                onClick={() => navigator.clipboard.writeText(renderBody(s.body, mcpName))}>
                Copy
              </Button>
            </Stack>
            <Collapse in={!!open[s.name]}>
              <Box component="pre" sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1,
                whiteSpace: 'pre-wrap', fontSize: 12, overflowX: 'auto' }}>
                {renderBody(s.body, mcpName)}
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/views/SetupWizard.step2.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/SetupWizard.tsx frontend/src/views/SetupWizard.step2.test.tsx
git commit -m "feat(wizard): step 2 add skills — hidden body, name-templated copy"
```

---

### Task 9: Step 3 — Add Automations + Finish

**Files:**
- Modify: `frontend/src/views/SetupWizard.tsx` (replace `Step3Automations`; wire Finish)
- Test: `frontend/src/views/SetupWizard.step3.test.tsx` (create)

**Interfaces:**
- Consumes: `getSkills`, `setConfig` from `api.ts`.
- Produces: `Step3Automations` lists each skill with a natural-language frequency `Select` (presets + custom) and a copyable action string `Run the '<skill>' skill`. The wizard's final button on step 3 reads "Finish" and calls `setConfig('wizard_done', '1')`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/views/SetupWizard.step3.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './../api'
import { SetupWizard } from './SetupWizard'

beforeEach(() => {
  vi.spyOn(api, 'getMcpConfig').mockResolvedValue({ url: 'u', token: 't', configured: true })
  vi.spyOn(api, 'getConfig').mockResolvedValue({ mcp_name: 'my-scout' })
  vi.spyOn(api, 'getMcpStatus').mockResolvedValue({ last_seen: null })
  vi.spyOn(api, 'getSkills').mockResolvedValue([{ name: 'triage_email', description: 'd', body: 'b' }])
  vi.spyOn(api, 'setConfig').mockResolvedValue({ key: 'wizard_done', value: '1' })
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

async function goToAutomations() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByRole('button', { name: /next/i }))
  fireEvent.click(await screen.findByRole('button', { name: /next/i }))
}

describe('Step 3 Automations', () => {
  it('copies the action string for a skill', async () => {
    await goToAutomations()
    fireEvent.click(await screen.findByRole('button', { name: /copy action/i }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Run the 'triage_email' skill"))
  })
  it('Finish marks wizard_done', async () => {
    await goToAutomations()
    fireEvent.click(await screen.findByRole('button', { name: /finish/i }))
    await waitFor(() => expect(api.setConfig).toHaveBeenCalledWith('wizard_done', '1'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/SetupWizard.step3.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Step3Automations + Finish**

Add imports (`Select, MenuItem`). The presets:

```tsx
const FREQ_PRESETS = [
  'Every weekday at 2:00 PM',
  'Every day at 7:00 AM',
  'Every hour',
  'Every 30 minutes',
  'Every Monday at 9:00 AM',
]

function Step3Automations() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [freq, setFreq] = useState<Record<string, string>>({})
  useEffect(() => { getSkills().then(setSkills) }, [])
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        An automation is <b>when</b> + <b>what</b>. Pick a frequency, then copy the action into a new
        Automation in Scout.
      </Typography>
      {skills.map((s) => {
        const f = freq[s.name] ?? FREQ_PRESETS[0]
        return (
          <Paper key={s.name} variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', mb: 1 }}>{s.name}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
              <Select size="small" value={f} sx={{ minWidth: 220 }}
                onChange={(e) => setFreq((m) => ({ ...m, [s.name]: e.target.value }))}>
                {FREQ_PRESETS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
              <Button size="small" onClick={() => navigator.clipboard.writeText(f)}>Copy schedule</Button>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>
                Run the '{s.name}' skill
              </Typography>
              <Button size="small" variant="contained"
                onClick={() => navigator.clipboard.writeText(`Run the '${s.name}' skill`)}>
                Copy action
              </Button>
            </Stack>
          </Paper>
        )
      })}
    </Stack>
  )
}
```

Change the navigation button on the last step to Finish. In `SetupWizard`, replace the Next button block:

```tsx
        {active === STEPS.length - 1
          ? <Button variant="contained" onClick={() => setConfig('wizard_done', '1')}>Finish</Button>
          : <Button variant="contained" onClick={() => setActive((s) => s + 1)}>Next</Button>}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/views/SetupWizard.step3.test.tsx`
Expected: PASS

- [ ] **Step 5: Full FE suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all tests pass; build succeeds

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/SetupWizard.tsx frontend/src/views/SetupWizard.step3.test.tsx
git commit -m "feat(wizard): step 3 automations — frequency presets, action copy, finish"
```

---

### Task 10: Insert `{{mcp_name}}` token into skill bodies

**Files:**
- Modify: `skills/*/SKILL.md` (all 17)
- Test: shell verification (no unit test file)

**Interfaces:**
- Produces: every `SKILL.md` body references the server as `{{mcp_name}}` instead of a hardcoded name/URL, so Task 8's substitution shows a real name.

**Transformation rule (apply per file):**
In each `SKILL.md`, the body has an MCP-server reference like:

```
This skill runs entirely through the Scout **MCP server** at `http://127.0.0.1:8766`
(default port; bearer token `EA_MCP_TOKEN`). ...
```

Rewrite the server-name reference to use the token and drop the hardcoded URL/token (Scout now holds those):

```
This skill runs entirely through the **{{mcp_name}}** MCP server. ...
```

Leave all task logic untouched. Do NOT rewrite heartbeat/lookback wording in this task (see Deferred).

- [ ] **Step 1: Apply the edit to every skill**

For each file under `skills/*/SKILL.md`, replace the hardcoded server reference with the `{{mcp_name}}` phrasing above. Do them individually (the surrounding sentence differs slightly per skill) — read the "## MCP server" area, swap the name, remove the `http://127.0.0.1:8766` / `EA_MCP_TOKEN` literals from that sentence.

- [ ] **Step 2: Verify tokens present and literals gone**

Run:
```bash
cd /home/user/code/Scout_EA
echo "files missing token:"; for f in skills/*/SKILL.md; do grep -qL "{{mcp_name}}" "$f" && echo "$f"; done
echo "remaining hardcoded endpoints:"; grep -rl "127.0.0.1:8766" skills/ || echo "none"
```
Expected: no files listed as missing the token; "none" for hardcoded endpoints.

- [ ] **Step 3: Sanity-check the API still serves bodies**

Run: `cd backend && python -m pytest -q -k skill`
Expected: existing skill tests pass (parser unaffected by body text change).

- [ ] **Step 4: Commit**

```bash
git add skills/
git commit -m "refactor(skills): reference server as {{mcp_name}} token for wizard templating"
```

---

## Deferred (follow-up, not in this plan)

- **Per-skill heartbeat/lookback rewrite.** Skill bodies still describe a "heartbeat" fallback window (e.g. `now - heartbeat_minutes`) and carry `schedule: heartbeat ...` frontmatter. Since timing now lives in Scout automations, each skill's lookback logic should be reworked to derive its window from the last `log_skill_run` only (no heartbeat default), and the frontmatter `schedule:` line updated or dropped. This is per-skill semantic work, independent of the wizard, and is safe to ship after.

## Self-Review notes

- Spec coverage: MCP name persist (T1,T7), url+token exposure (T2), last-seen validation (T3,T4,T7), templating (T8,T10), wizard 3 steps (T6–T9), NL frequency (T9), deep-inspect retained (T6 keeps existing Skills tab; T8 View collapse). All covered.
- Deviation from spec: spec said "remove the old DataGrid"; plan keeps it as the secondary "Skills" tab for deep inspection (lazier, reuses existing modal, satisfies "inspect somewhere"). Activity tab unchanged.
- Token consistency: `mcp_name`, `wizard_done`, `mcp_last_seen`, `getMcpConfig`, `getMcpStatus`, `McpConfig`, `McpStatus`, `renderBody` used consistently across tasks.
