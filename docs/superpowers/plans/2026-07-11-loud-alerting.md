# Loud Alerting (SP-B3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make urgent alerts hard to miss — repeat the push until acknowledged (bounded), keep it on screen in the background, and chime in the foreground — reusing the existing alerts + web-push pipe.

**Architecture:** One new `alerts.repeat_count` column (cadence anchored on the existing `updated_at` touch-trigger). A `repush_loud_alerts` worker step re-sends unacked loud alerts every 5 min up to 2 repeats. The push payload gains `loud`/`tag`; the service worker persists loud notifications (`requireInteraction`/`renotify`); a foreground `useAlertChime` hook plays a Web Audio beep. Threshold + sound are `config` KV keys surfaced in Settings.

**Tech Stack:** Python 3 / FastAPI / sqlite3 / pytest (backend); React 19 / MUI v7 / TypeScript / TanStack Query / Vitest (frontend); Web Push + service worker + Web Audio.

## Global Constraints

- No new dependencies. No new tables, no new endpoints.
- Exactly one new column: `alerts.repeat_count INTEGER NOT NULL DEFAULT 0`.
- Config keys (both in `WRITABLE_CONFIG`): `alert_loud_threshold` ∈ `off`|`critical`|`warning` (default `critical`); `alert_sound_enabled` ∈ `"1"`|`"0"` (default `"1"`).
- Threshold → severity set: `off`→`{}` (disabled); `critical`→`{critical}`; `warning`→`{warning,critical}`; any unrecognized non-`off` value → `{critical}`.
- Repeat: `LOUD_REPEAT_MINUTES = 5`, `LOUD_REPEAT_MAX = 2` (initial send + 2 repeats = 3 total).
- Acknowledgement = alert `status` leaving `'unread'` (existing `POST /api/{table}/{row_id}/status`). No new ack surface.
- Push payload shape: `{title, body, loud: bool, tag: str}`; `tag = f"alert-{id}"`.
- `info` severity is never loud.

---

### Task 1: Schema + migration + config allowlist

**Files:**
- Modify: `backend/ea/schema.sql:85` (add column to `alerts`)
- Modify: `backend/ea/db.py:34-50` (`_migrate` add-column block), `backend/ea/db.py:417` (`WRITABLE_CONFIG`)
- Test: `backend/tests/test_loud_alerting.py` (create)

**Interfaces:**
- Consumes: `db.init_db(path, seed_path=db.DEFAULT_SEED)`, `db._migrate(conn)`, `db.set_config(conn, key, value)`.
- Produces: `alerts.repeat_count` column on fresh + migrated DBs; `alert_loud_threshold` / `alert_sound_enabled` writable via `set_config`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_loud_alerting.py`:

```python
"""Loud alerting — repeat-until-ack push + config for urgent alerts."""
from ea import db


def test_migrate_adds_repeat_count(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    # Simulate a pre-existing DB that predates the column.
    conn.execute("ALTER TABLE alerts DROP COLUMN repeat_count")
    conn.commit()
    assert not any(r[1] == "repeat_count" for r in conn.execute("PRAGMA table_info(alerts)"))
    db._migrate(conn)
    assert any(r[1] == "repeat_count" for r in conn.execute("PRAGMA table_info(alerts)"))


def test_config_keys_writable(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    db.set_config(conn, "alert_loud_threshold", "warning")
    db.set_config(conn, "alert_sound_enabled", "0")
    rows = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM config")}
    assert rows["alert_loud_threshold"] == "warning"
    assert rows["alert_sound_enabled"] == "0"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_loud_alerting.py -v`
Expected: FAIL — `test_migrate_adds_repeat_count` errors on `DROP COLUMN repeat_count` (column doesn't exist yet); `test_config_keys_writable` raises `ValueError: config key not writable`.

- [ ] **Step 3: Add the column to fresh-DB schema — `backend/ea/schema.sql`**

In the `alerts` table (after the `notified_push` line at :85), add:

```sql
    notified_push  INTEGER NOT NULL DEFAULT 0,  -- web push (container, tab-closed)
    repeat_count   INTEGER NOT NULL DEFAULT 0,  -- loud-alert repeat tracking
```

- [ ] **Step 4: Add the migration block — `backend/ea/db.py`**

In `_migrate`, after the `board_columns` seeding block (before the function returns), add:

```python
    # Add alerts.repeat_count for pre-existing DBs (fresh DBs get it from schema.sql).
    alerts_pragma = conn.execute("PRAGMA table_info(alerts)").fetchall()
    if not any(r[1] == "repeat_count" for r in alerts_pragma):
        conn.execute("ALTER TABLE alerts ADD COLUMN repeat_count INTEGER NOT NULL DEFAULT 0")
        conn.commit()
```

- [ ] **Step 5: Allowlist the config keys — `backend/ea/db.py:417`**

```python
WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days",
                   "reminder_enabled", "reminder_lead_minutes",
                   "alert_loud_threshold", "alert_sound_enabled"}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_loud_alerting.py -v`
Expected: PASS (both tests).

- [ ] **Step 7: Commit**

```bash
git add backend/ea/schema.sql backend/ea/db.py backend/tests/test_loud_alerting.py
git commit -m "feat(loud-alerting): repeat_count column + migration + config allowlist"
```

---

### Task 2: Repeat engine + loud payload + worker wiring

**Files:**
- Modify: `backend/lib/push.py` (`_loud_severities`, `repush_loud_alerts`, `send_push` params, `push_pending_alerts` payload)
- Modify: `backend/lib/push_worker.py:16-17` (call `repush_loud_alerts`)
- Test: `backend/tests/test_loud_alerting.py` (extend)

**Interfaces:**
- Consumes: `_vapid_available()`, `send_push(conn, title, body, ...)`, `db.list_subscriptions`, `alerts.repeat_count` (Task 1), config keys (Task 1).
- Produces: `push._loud_severities(conn) -> set[str]`; `push.repush_loud_alerts(conn, limit=20) -> int`; `send_push(conn, title, body, loud=False, tag=None, claims_email=...)` now emits `{title, body, loud, tag}`; `push_pending_alerts` sends `loud`/`tag` per severity.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_loud_alerting.py`:

```python
import json
from lib import push


def _conn(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    conn.execute("DELETE FROM alerts")
    db.add_subscription(conn, "https://push.example.com/1", "p", "a")
    conn.commit()
    return conn


def _record_webpush(monkeypatch):
    import pywebpush
    calls = []
    monkeypatch.setattr(pywebpush, "webpush", lambda **kw: calls.append(kw))
    return calls


def test_loud_severities_mapping(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    assert push._loud_severities(conn) == {"critical"}          # default
    db.set_config(conn, "alert_loud_threshold", "warning")
    assert push._loud_severities(conn) == {"warning", "critical"}
    db.set_config(conn, "alert_loud_threshold", "off")
    assert push._loud_severities(conn) == set()


def test_initial_push_marks_loud_payload(tmp_path, monkeypatch):
    calls = _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO alerts (severity,title,body,status) VALUES ('critical','C','x','unread')")
    conn.execute("INSERT INTO alerts (severity,title,body,status) VALUES ('warning','W','y','unread')")
    conn.commit()
    push.push_pending_alerts(conn)                              # threshold default = critical
    payloads = [json.loads(c["data"]) for c in calls]
    by_title = {p["title"]: p for p in payloads}
    assert by_title["C"]["loud"] is True
    assert by_title["C"]["tag"].startswith("alert-")
    assert by_title["W"]["loud"] is False


def test_repush_resends_after_interval(tmp_path, monkeypatch):
    calls = _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    # critical, already initially pushed, unread, updated_at 6 min ago
    conn.execute(
        "INSERT INTO alerts (severity,title,body,status,notified_push,repeat_count,updated_at) "
        "VALUES ('critical','C','x','unread',1,0,datetime('now','-6 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 1
    assert len(calls) == 1
    assert conn.execute("SELECT repeat_count FROM alerts").fetchone()["repeat_count"] == 1


def test_repush_waits_for_interval(tmp_path, monkeypatch):
    _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO alerts (severity,title,body,status,notified_push,repeat_count,updated_at) "
        "VALUES ('critical','C','x','unread',1,0,datetime('now','-1 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 0                   # only 1 min elapsed


def test_repush_stops_at_cap(tmp_path, monkeypatch):
    _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO alerts (severity,title,body,status,notified_push,repeat_count,updated_at) "
        "VALUES ('critical','C','x','unread',1,2,datetime('now','-30 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 0                   # repeat_count already at cap


def test_repush_excludes_acked_and_below_threshold(tmp_path, monkeypatch):
    _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO alerts (severity,title,status,notified_push,repeat_count,updated_at) "
                 "VALUES ('critical','acked','read',1,0,datetime('now','-6 minutes'))")
    conn.execute("INSERT INTO alerts (severity,title,status,notified_push,repeat_count,updated_at) "
                 "VALUES ('warning','low','unread',1,0,datetime('now','-6 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 0                   # acked skipped; warning below default threshold


def test_repush_off_threshold(tmp_path, monkeypatch):
    _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    db.set_config(conn, "alert_loud_threshold", "off")
    conn.execute("INSERT INTO alerts (severity,title,status,notified_push,repeat_count,updated_at) "
                 "VALUES ('critical','C','unread',1,0,datetime('now','-6 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_loud_alerting.py -v`
Expected: FAIL — `AttributeError: module 'lib.push' has no attribute '_loud_severities'` / `repush_loud_alerts`.

- [ ] **Step 3: Add `_loud_severities` + `repush_loud_alerts`, extend `send_push` and `push_pending_alerts` — `backend/lib/push.py`**

Replace the current `send_push` signature/payload lines:

```python
def send_push(conn, title, body, loud=False, tag=None, claims_email="mailto:admin@scout-ea.local"):
    """Send a push to every subscription. Returns count sent. Deletes dead subs (404/410)."""
    if not _vapid_available():
        return 0

    from pywebpush import webpush, WebPushException
    from ea import db

    pub, priv = ensure_vapid(conn)
    payload = json.dumps({"title": title, "body": body, "loud": bool(loud), "tag": tag})
    sent = 0
```

Replace `push_pending_alerts` body with (loud payload per severity):

```python
def push_pending_alerts(conn, limit=20) -> int:
    """Send Web Push for unpushed critical/warning alerts; mark them notified_push=1. Returns count sent.

    The web server is the single owner of push (no double-fire). No-op (returns 0) when
    pywebpush is unavailable or there are no subscriptions.
    """
    if not _vapid_available():
        return 0
    loud = _loud_severities(conn)
    rows = conn.execute(
        "SELECT id, title, body, severity FROM alerts "
        "WHERE notified_push=0 AND severity IN ('critical','warning') "
        "ORDER BY created_at DESC LIMIT ?", (int(limit),)).fetchall()
    sent = 0
    for a in rows:
        send_push(conn, a["title"], a["body"] or "",
                  loud=a["severity"] in loud, tag=f"alert-{a['id']}")
        conn.execute("UPDATE alerts SET notified_push=1 WHERE id=?", (a["id"],))
        sent += 1
    conn.commit()
    return sent
```

Add near the top of the module (after imports) the constants + helper, and after `push_pending_alerts` the repeat engine:

```python
LOUD_REPEAT_MINUTES = 5
LOUD_REPEAT_MAX = 2   # initial send + 2 repeats = 3 notifications total


def _loud_severities(conn) -> set[str]:
    """Severity names that qualify for loud (repeat + sound) treatment. Empty set when 'off'."""
    cfg = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM config")}
    thr = cfg.get("alert_loud_threshold", "critical")
    if thr == "off":
        return set()
    if thr == "warning":
        return {"warning", "critical"}
    return {"critical"}   # 'critical' or any unrecognized value


def repush_loud_alerts(conn, limit=20) -> int:
    """Re-push unacknowledged loud alerts, up to LOUD_REPEAT_MAX times, LOUD_REPEAT_MINUTES apart.
    Ack = status leaving 'unread' (repeats stop). Cadence anchored on updated_at (touch trigger
    re-anchors it each repeat). Returns count resent. No-op when threshold is 'off'."""
    if not _vapid_available():
        return 0
    loud = _loud_severities(conn)
    if not loud:
        return 0
    placeholders = ",".join("?" * len(loud))
    rows = conn.execute(
        f"SELECT id, title, body FROM alerts "
        f"WHERE status='unread' AND notified_push=1 AND severity IN ({placeholders}) "
        f"AND repeat_count < ? "
        f"AND datetime('now') >= datetime(updated_at, ?) "
        f"ORDER BY created_at DESC LIMIT ?",
        (*sorted(loud), LOUD_REPEAT_MAX, f"+{LOUD_REPEAT_MINUTES} minutes", int(limit))
    ).fetchall()
    sent = 0
    for a in rows:
        send_push(conn, a["title"], a["body"] or "", loud=True, tag=f"alert-{a['id']}")
        conn.execute("UPDATE alerts SET repeat_count = repeat_count + 1 WHERE id=?", (a["id"],))
        sent += 1
    if sent:
        conn.commit()
    return sent
```

- [ ] **Step 4: Wire into the worker — `backend/lib/push_worker.py`**

In `loop()`, add the repush call after `push_pending_alerts`:

```python
                    push.generate_due_reminders(conn)
                    push.push_pending_alerts(conn)
                    push.repush_loud_alerts(conn)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_loud_alerting.py tests/test_push.py tests/test_reminders.py -v`
Expected: PASS (new loud tests + unchanged push/reminder tests — the extra `loud`/`tag` payload keys don't break existing payload assertions, which check `title`/`body` only).

- [ ] **Step 6: Commit**

```bash
git add backend/lib/push.py backend/lib/push_worker.py backend/tests/test_loud_alerting.py
git commit -m "feat(loud-alerting): repush_loud_alerts engine + loud push payload"
```

---

### Task 3: Service worker loud notification options

**Files:**
- Create: `frontend/src/lib/notificationOptions.ts`
- Modify: `frontend/public/sw.js`
- Test: `frontend/src/lib/notificationOptions.test.ts` (create)

**Interfaces:**
- Produces: `buildNotificationOptions(data: {title?,body?,loud?,tag?}) -> NotificationOptions` (importable, tested). `sw.js` inlines a mirror of this logic (SW can't import app modules without bundling).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/notificationOptions.test.ts`:

```ts
import { it, expect } from 'vitest'
import { buildNotificationOptions } from './notificationOptions'

it('loud → requireInteraction + renotify + tag', () => {
  const o = buildNotificationOptions({ body: 'b', loud: true, tag: 'alert-7' }) as Record<string, unknown>
  expect(o.requireInteraction).toBe(true)
  expect(o.renotify).toBe(true)
  expect(o.tag).toBe('alert-7')
  expect(o.body).toBe('b')
})

it('non-loud → no requireInteraction', () => {
  const o = buildNotificationOptions({ body: 'b', loud: false, tag: 'alert-7' }) as Record<string, unknown>
  expect(o.requireInteraction).toBeUndefined()
  expect(o.tag).toBe('alert-7')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/notificationOptions.test.ts`
Expected: FAIL — cannot resolve `./notificationOptions`.

- [ ] **Step 3: Create `frontend/src/lib/notificationOptions.ts`**

```ts
export interface PushData {
  title?: string
  body?: string
  loud?: boolean
  tag?: string
}

/** Build showNotification options from a push payload. Loud alerts stay on screen and re-alert. */
export function buildNotificationOptions(data: PushData): NotificationOptions {
  const opts: NotificationOptions = { body: data.body || '', icon: '/vite.svg', badge: '/vite.svg' }
  if (data.tag) opts.tag = data.tag
  if (data.loud) {
    opts.requireInteraction = true
    // renotify is valid at runtime but missing from the DOM lib types
    ;(opts as NotificationOptions & { renotify?: boolean }).renotify = true
  }
  return opts
}
```

- [ ] **Step 4: Mirror the logic in `frontend/public/sw.js`**

Replace the `push` handler; add the mirrored function above it:

```js
// ponytail: mirrors src/lib/notificationOptions.ts (~6 lines). A service worker can't import
// app modules without a bundler step; the logic is trivial and unit-tested there. Keep in sync.
function buildNotificationOptions(data) {
  const opts = { body: data.body || '', icon: '/vite.svg', badge: '/vite.svg' }
  if (data.tag) opts.tag = data.tag
  if (data.loud) { opts.requireInteraction = true; opts.renotify = true }
  return opts
}
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Scout EA', buildNotificationOptions(data))
  )
})
```

Leave the existing `notificationclick` handler unchanged.

- [ ] **Step 5: Run test + typecheck**

Run: `cd frontend && npx vitest run src/lib/notificationOptions.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/notificationOptions.ts frontend/src/lib/notificationOptions.test.ts frontend/public/sw.js
git commit -m "feat(loud-alerting): service worker persists loud notifications"
```

---

### Task 4: Foreground chime hook

**Files:**
- Create: `frontend/src/lib/useAlertChime.ts`
- Modify: `frontend/src/App.tsx:25` (mount the hook)
- Test: `frontend/src/lib/useAlertChime.test.ts` (create)

**Interfaces:**
- Consumes: `getAlerts`, `type Alert` from `@/api`; `GET /api/config`.
- Produces: `shouldChime(seen, alerts, cfg) -> {chime: boolean, seen: number}` (pure, tested); `useAlertChime()` hook (renders nothing, plays a beep on new unread loud alerts).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/useAlertChime.test.ts`:

```ts
import { it, expect } from 'vitest'
import { shouldChime } from './useAlertChime'
import type { Alert } from '@/api'

const mk = (id: number, severity: string, status = 'unread'): Alert =>
  ({ id, severity, status, title: 't', created_at: '' } as Alert)

it('primes on first load without chiming', () => {
  const r = shouldChime(null, [mk(1, 'critical'), mk(3, 'critical')], {})
  expect(r).toEqual({ chime: false, seen: 3 })
})

it('chimes on a new unread critical (default threshold)', () => {
  const r = shouldChime(3, [mk(3, 'critical'), mk(5, 'critical')], {})
  expect(r).toEqual({ chime: true, seen: 5 })
})

it('does not chime when sound disabled', () => {
  const r = shouldChime(3, [mk(5, 'critical')], { alert_sound_enabled: '0' })
  expect(r.chime).toBe(false)
})

it('does not chime for below-threshold severity', () => {
  const r = shouldChime(3, [mk(5, 'warning')], { alert_loud_threshold: 'critical' })
  expect(r.chime).toBe(false)
})

it('chimes for warning when threshold=warning', () => {
  const r = shouldChime(3, [mk(5, 'warning')], { alert_loud_threshold: 'warning' })
  expect(r.chime).toBe(true)
})

it('does not chime for an already-read new alert', () => {
  const r = shouldChime(3, [mk(5, 'critical', 'read')], {})
  expect(r.chime).toBe(false)
})

it('does not chime when nothing new', () => {
  const r = shouldChime(5, [mk(5, 'critical')], {})
  expect(r).toEqual({ chime: false, seen: 5 })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/useAlertChime.test.ts`
Expected: FAIL — cannot resolve `./useAlertChime`.

- [ ] **Step 3: Create `frontend/src/lib/useAlertChime.ts`**

```ts
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAlerts, type Alert } from '@/api'

function loudSet(threshold: string | undefined): Set<string> {
  if (threshold === 'off') return new Set()
  if (threshold === 'warning') return new Set(['warning', 'critical'])
  return new Set(['critical'])
}

/** Pure decision: given the last-seen max id, the current alerts, and config, should we chime? */
export function shouldChime(
  seen: number | null,
  alerts: Alert[],
  cfg: Record<string, string>,
): { chime: boolean; seen: number } {
  const maxId = alerts.reduce((m, a) => Math.max(m, a.id), 0)
  if (seen === null) return { chime: false, seen: maxId }        // first load: prime, never chime
  if (maxId <= seen) return { chime: false, seen }
  if (cfg.alert_sound_enabled === '0') return { chime: false, seen: maxId }
  const loud = loudSet(cfg.alert_loud_threshold)
  const fresh = alerts.filter((a) => a.id > seen)
  const chime = fresh.some((a) => a.status === 'unread' && loud.has(a.severity))
  return { chime, seen: maxId }
}

function playChime(): void {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  try {
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    /* autoplay blocked or Web Audio unavailable — chime is best-effort; the notification is guaranteed */
  }
}

/** Foreground-only chime on new unread loud alerts. Renders nothing. Mount once inside the app. */
export function useAlertChime(): void {
  const alertsQ = useQuery({ queryKey: ['alerts'], queryFn: getAlerts, refetchInterval: 15000 })
  const cfgQ = useQuery({ queryKey: ['config'], queryFn: () => fetch('/api/config').then((r) => r.json()) })
  const seen = useRef<number | null>(null)

  useEffect(() => {
    if (!alertsQ.data) return
    const { chime, seen: next } = shouldChime(seen.current, alertsQ.data, cfgQ.data || {})
    seen.current = next
    if (chime) playChime()
  }, [alertsQ.data, cfgQ.data])
}
```

- [ ] **Step 4: Mount the hook — `frontend/src/App.tsx`**

Add the import at the top of the file:

```tsx
import { useAlertChime } from '@/lib/useAlertChime'
```

Call it inside `App()` (e.g. right after `const queryClient = useQueryClient()`):

```tsx
  useAlertChime()
```

- [ ] **Step 5: Run test + typecheck + build**

Run: `cd frontend && npx vitest run src/lib/useAlertChime.test.ts && npx tsc --noEmit && npm run build`
Expected: PASS, no type errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/useAlertChime.ts frontend/src/lib/useAlertChime.test.ts frontend/src/App.tsx
git commit -m "feat(loud-alerting): foreground Web Audio chime on new loud alerts"
```

---

### Task 5: Settings "Alert urgency" controls

**Files:**
- Modify: `frontend/src/views/Settings.tsx` (add group in the Notifications section)
- Test: `frontend/src/views/Settings.test.tsx` (add cases)

**Interfaces:**
- Consumes: the `config` query (`useQuery(['config'])`) + `saveCfg` mutation (`setConfig`) already present in `SettingsView` from the reminders feature; `ToggleButton`/`ToggleButtonGroup`/`TextField` (already imported).
- Produces: UI writing `alert_loud_threshold` (`off`/`critical`/`warning`) and `alert_sound_enabled` (`"1"`/`"0"`).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/views/Settings.test.tsx` (reuse the file's existing render helper + `/api/config` fetch mock, mirroring the reminders test added earlier):

```tsx
it('alert urgency: changing threshold calls setConfig', async () => {
  const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
    if (url.includes('/api/config') && (!opts || opts.method !== 'POST')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ key: 'x', value: 'y' }) } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)

  renderSettings() // the file's existing render helper

  const sel = await screen.findByLabelText('Loud alert threshold')
  fireEvent.change(sel, { target: { value: 'warning' } })

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/config/alert_loud_threshold',
      expect.objectContaining({ method: 'POST' }),
    ),
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/Settings.test.tsx`
Expected: FAIL — no element with label `Loud alert threshold`.

- [ ] **Step 3: Add the Alert urgency group — `frontend/src/views/Settings.tsx`**

Near the other derived config values (where `reminderOn`/`leadMin` are defined), add:

```tsx
  const loudThreshold = cfg.alert_loud_threshold ?? 'critical'
  const soundOn = cfg.alert_sound_enabled !== '0'
```

Inside the Notifications `<Box>` (a sibling to the Reminders block), add:

```tsx
            {/* Alert urgency */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                Alert urgency
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  select
                  size="small"
                  label="Loud for"
                  value={loudThreshold}
                  onChange={(e) => saveCfg.mutate({ key: 'alert_loud_threshold', value: e.target.value })}
                  slotProps={{ select: { native: true }, htmlInput: { 'aria-label': 'Loud alert threshold' } }}
                  sx={{ minWidth: 180 }}
                >
                  <option value="off">Off</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Critical + Warning</option>
                </TextField>
                <ToggleButtonGroup
                  value={soundOn ? 'on' : 'off'}
                  exclusive
                  onChange={(_e, v) => {
                    if (v !== null) saveCfg.mutate({ key: 'alert_sound_enabled', value: v === 'on' ? '1' : '0' })
                  }}
                >
                  <ToggleButton value="on" aria-label="alert sound on" disabled={loudThreshold === 'off'}>Sound</ToggleButton>
                  <ToggleButton value="off" aria-label="alert sound off" disabled={loudThreshold === 'off'}>Muted</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                Loud alerts repeat every 5 minutes (up to 3 times) until you silence or dismiss them.
              </Typography>
            </Box>
```

- [ ] **Step 4: Run test + typecheck + build**

Run: `cd frontend && npx vitest run src/views/Settings.test.tsx && npx tsc --noEmit && npm run build`
Expected: PASS, no type errors, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Settings.tsx frontend/src/views/Settings.test.tsx
git commit -m "feat(loud-alerting): Settings alert-urgency threshold + sound controls"
```

---

## Self-Review

**Spec coverage:**
- Config keys + defaults + WRITABLE_CONFIG → Task 1 (allowlist) + Task 5 (UI) + `_loud_severities` default. ✓
- `repeat_count` column, fresh + migrated → Task 1 Steps 3–4. ✓
- Threshold→severity mapping → `_loud_severities` (Task 2) + `loudSet` (Task 4) — both cover off/critical/warning/default. ✓
- Repeat engine (5m, cap 2, ack via status, updated_at anchor) → Task 2 `repush_loud_alerts` + tests. ✓
- Loud payload `{title,body,loud,tag}` → Task 2 `send_push`/`push_pending_alerts`. ✓
- Worker wiring → Task 2 Step 4. ✓
- SW requireInteraction/renotify/tag → Task 3. ✓
- Foreground Web Audio chime, no asset, prime-on-first-load → Task 4. ✓
- Settings threshold + sound, disabled-when-off, repeat copy → Task 5. ✓
- Ack via existing status endpoint → no task needed (documented reuse). ✓
- Tests for every unit → Tasks 1–5 each include tests. ✓

**Placeholder scan:** none — all code shown. The two adapt-to-existing points (Task 5's `renderSettings` helper and the reused `cfg`/`saveCfg` from the reminders feature) reference concrete existing code, not unwritten logic. Task 3 deliberately mirrors ~6 trivial lines into `sw.js` with a `ponytail:` comment — a bundler-free service worker cannot import the tested module; this is an intentional, commented simplification, not a placeholder.

**Type consistency:** `_loud_severities(conn) -> set[str]` and `loudSet(threshold) -> Set<string>` apply the identical off/warning/critical mapping on each side. `repush_loud_alerts` / `push_pending_alerts` / `send_push(loud, tag)` signatures match across Task 2 and its tests. Payload keys `{title, body, loud, tag}` identical in `send_push` (Task 2), `buildNotificationOptions` input (Task 3), and `PushData` (Task 3). `tag = f"alert-{id}"` / `alert-7` consistent. `shouldChime(seen, alerts, cfg)` return `{chime, seen}` matches the hook usage and tests (Task 4). Config keys `alert_loud_threshold` / `alert_sound_enabled` spelled identically everywhere.
