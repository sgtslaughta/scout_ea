# Timeline Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fire browser push reminders a configurable lead time before deadlines, tasks, events, and news items come due, reusing the existing web-push pipe.

**Architecture:** A new `generate_due_reminders(conn)` scan runs each `push_worker` tick, inserts one `warning` alert per item entering its lead window (deduped on `alerts.source_table+source_id`), and the existing `push_pending_alerts` — broadened to send `warning` too — delivers them. Lead time + on/off live in the `config` KV table, edited from Settings. No schema migration.

**Tech Stack:** Python 3 / FastAPI / sqlite3 / pytest (backend); React 19 / MUI v7 / TypeScript / TanStack Query / Vitest (frontend).

## Global Constraints

- No new dependencies (backend or frontend).
- No schema migration, no new tables, no new per-item columns.
- Keep files under 500 lines.
- Reminder alerts use `severity='warning'`; delivery filter becomes `severity IN ('critical','warning')`.
- Config keys: `reminder_enabled` (`"1"`/`"0"`, default on) and `reminder_lead_minutes` (int string, default `"15"`).
- Reminder `source_table` tags (exact): `deadline`, `task`, `event`, `news`.
- Dedup is `NOT EXISTS (alert with matching source_table+source_id)` — no new `notified_*` columns.

---

### Task 1: Backend reminder engine

**Files:**
- Modify: `backend/lib/push.py` (add `generate_due_reminders`; broaden `push_pending_alerts` filter)
- Modify: `backend/lib/push_worker.py:16` (call new fn in loop)
- Modify: `backend/ea/db.py:417` (`WRITABLE_CONFIG` allowlist)
- Test: `backend/tests/test_reminders.py` (create)

**Interfaces:**
- Consumes: `db.init_db(path, seed_path=db.DEFAULT_SEED)`, `db.get_conn(path)`, existing `alerts` table (`severity,title,body,source_table,source_id,status,notified_push`), `config` table.
- Produces: `push.generate_due_reminders(conn) -> int` (count of alert rows inserted). `push_pending_alerts` now also sends `severity='warning'` rows.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_reminders.py`:

```python
"""Timeline reminder generation — inserts deduped 'warning' alerts for items due within lead window."""
from ea import db
from lib import push


def _conn(tmp_path):
    # Clean slate so seed rows don't perturb count assertions.
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    for t in ("alerts", "critical_deadlines", "tasks", "events", "news_items"):
        conn.execute(f"DELETE FROM {t}")
    conn.commit()
    return conn


def test_deadline_in_window_creates_one_alert(tmp_path):
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
        "VALUES ('Board memo', datetime('now','+10 minutes'), 'test', 'active', 1)")
    conn.commit()

    n = push.generate_due_reminders(conn)
    assert n == 1
    row = conn.execute(
        "SELECT severity, source_table, source_id FROM alerts").fetchone()
    assert row["severity"] == "warning"
    assert row["source_table"] == "deadline"
    assert row["source_id"] == 1


def test_reminder_is_deduped_on_second_run(tmp_path):
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
        "VALUES ('Board memo', datetime('now','+10 minutes'), 'test', 'active', 1)")
    conn.commit()
    assert push.generate_due_reminders(conn) == 1
    assert push.generate_due_reminders(conn) == 0
    assert conn.execute("SELECT COUNT(*) c FROM alerts").fetchone()["c"] == 1


def test_item_outside_window_no_alert(tmp_path):
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
        "VALUES ('Far off', datetime('now','+2 hours'), 'test', 'active', 1)")
    conn.commit()
    assert push.generate_due_reminders(conn) == 0


def test_disabled_flag_suppresses(tmp_path):
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO config(key,value) VALUES('reminder_enabled','0') "
                 "ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
        "VALUES ('Board memo', datetime('now','+10 minutes'), 'test', 'active', 1)")
    conn.commit()
    assert push.generate_due_reminders(conn) == 0


def test_all_four_sources_fire(tmp_path):
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
                 "VALUES ('D', datetime('now','+5 minutes'), 't', 'active', 1)")
    conn.execute("INSERT INTO tasks (title, due_at, status) "
                 "VALUES ('T', datetime('now','+5 minutes'), 'open')")
    conn.execute("INSERT INTO events (title, chosen_time, status) "
                 "VALUES ('E', datetime('now','+5 minutes'), 'scheduled')")
    conn.execute("INSERT INTO news_items (title, event_at, status) "
                 "VALUES ('N', datetime('now','+5 minutes'), 'new')")
    conn.commit()
    assert push.generate_due_reminders(conn) == 4
    tags = {r["source_table"] for r in conn.execute("SELECT source_table FROM alerts")}
    assert tags == {"deadline", "task", "event", "news"}


def test_pending_alerts_sends_warning(tmp_path, monkeypatch):
    import pywebpush
    calls = []
    monkeypatch.setattr(pywebpush, "webpush", lambda **kw: calls.append(kw))
    conn = _conn(tmp_path)
    db.add_subscription(conn, "https://push.example.com/1", "p", "a")
    conn.execute("INSERT INTO alerts (severity,title,body,status) "
                 "VALUES ('warning','Due soon: X','...','unread')")
    conn.commit()
    assert push.push_pending_alerts(conn) == 1
    assert len(calls) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_reminders.py -v`
Expected: FAIL — `AttributeError: module 'lib.push' has no attribute 'generate_due_reminders'` (and the warning-send test fails because the filter is still `='critical'`).

- [ ] **Step 3: Add `generate_due_reminders` and broaden the filter in `backend/lib/push.py`**

Append this to `backend/lib/push.py` (after `push_pending_alerts`):

```python
# ponytail: table-driven scan; each entry = (tag, SQL with one ? for the lead offset).
# Add a row here to cover another time-anchored table. Signals excluded — occurred_at is past.
_REMINDER_SOURCES = [
    ("deadline", "SELECT id, title, due_at AS t FROM critical_deadlines "
                 "WHERE status='active' AND visible=1 "
                 "AND due_at BETWEEN datetime('now') AND datetime('now', ?)"),
    ("task", "SELECT id, title, due_at AS t FROM tasks "
             "WHERE status != 'done' AND due_at IS NOT NULL "
             "AND due_at BETWEEN datetime('now') AND datetime('now', ?)"),
    ("event", "SELECT id, title, chosen_time AS t FROM events "
              "WHERE status NOT IN ('cancelled','declined') AND chosen_time IS NOT NULL "
              "AND chosen_time BETWEEN datetime('now') AND datetime('now', ?)"),
    ("news", "SELECT id, title, event_at AS t FROM news_items "
             "WHERE status != 'dismissed' AND event_at IS NOT NULL "
             "AND event_at BETWEEN datetime('now') AND datetime('now', ?)"),
]


def generate_due_reminders(conn) -> int:
    """Insert a 'warning' alert for each item whose due time falls within the reminder
    lead window and that has no alert yet. Deduped on alerts.source_table+source_id.
    Returns the number of alerts inserted. No-op when reminder_enabled != '1'."""
    cfg = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM config")}
    if cfg.get("reminder_enabled", "1") != "1":
        return 0
    try:
        lead = int(cfg.get("reminder_lead_minutes", "15"))
    except (TypeError, ValueError):
        lead = 15
    if lead < 1:
        lead = 15
    offset = f"+{lead} minutes"

    inserted = 0
    for tag, sql in _REMINDER_SOURCES:
        for r in conn.execute(sql, (offset,)).fetchall():
            dup = conn.execute(
                "SELECT 1 FROM alerts WHERE source_table=? AND source_id=?",
                (tag, r["id"])).fetchone()
            if dup:
                continue
            conn.execute(
                "INSERT INTO alerts (severity, title, body, source_table, source_id, status) "
                "VALUES ('warning', ?, ?, ?, ?, 'unread')",
                (f"Due soon: {r['title']}", f"Due at {r['t']}", tag, r["id"]))
            inserted += 1
    if inserted:
        conn.commit()
    return inserted
```

Then broaden the delivery filter — in `push_pending_alerts`, change the SQL line:

```python
    rows = conn.execute(
        "SELECT id, title, body FROM alerts "
        "WHERE notified_push=0 AND severity IN ('critical','warning') "
        "ORDER BY created_at DESC LIMIT ?", (int(limit),)).fetchall()
```

- [ ] **Step 4: Wire the scan into the worker — `backend/lib/push_worker.py`**

In the `loop()` body, call the scan before sending. Replace the inner `try` block body:

```python
                conn = db.get_conn(db_path)
                try:
                    push.generate_due_reminders(conn)
                    push.push_pending_alerts(conn)
                finally:
                    conn.close()
```

- [ ] **Step 5: Allowlist the config keys — `backend/ea/db.py:417`**

```python
WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days",
                   "reminder_enabled", "reminder_lead_minutes"}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_reminders.py tests/test_push.py -v`
Expected: PASS (all reminder tests + existing push tests green).

- [ ] **Step 7: Commit**

```bash
git add backend/lib/push.py backend/lib/push_worker.py backend/ea/db.py backend/tests/test_reminders.py
git commit -m "feat(reminders): due-item reminder scan generates warning alerts

generate_due_reminders scans deadlines/tasks/events/news for items entering
the configurable lead window, inserts deduped warning alerts; push_pending_alerts
broadened to deliver warning severity; reminder config keys allowlisted."
```

---

### Task 2: Settings reminder controls (frontend)

**Files:**
- Modify: `frontend/src/views/Settings.tsx` (add Reminders block in the Notifications section)
- Test: `frontend/src/views/Settings.test.tsx` (add cases)

**Interfaces:**
- Consumes: `setConfig(key: string, value: string)` from `@/api` (exists, `api.ts:241`); `GET /api/config` returning a `Record<string,string>`; TanStack Query `useQuery`/`useMutation`/`useQueryClient` (already imported in this file).
- Produces: UI writing `reminder_enabled` (`"1"`/`"0"`) and `reminder_lead_minutes` (int string) via `setConfig`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/views/Settings.test.tsx` (mirror the `/api/config` fetch-mock pattern used in `Deadlines.test.tsx`). If the file has no config mock yet, stub fetch so `/api/config` returns `{}` and `setConfig` POSTs succeed:

```tsx
import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
// NOTE: reuse the file's existing test wrapper/providers (QueryClientProvider + theme).
// If a renderWithProviders helper already exists in this file, call that instead of render.

it('reminders: changing lead minutes calls setConfig', async () => {
  const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
    if (url.includes('/api/config') && (!opts || opts.method !== 'POST')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ key: 'x', value: 'y' }) } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)

  renderSettings() // the file's existing render helper

  const lead = await screen.findByLabelText('Reminder lead minutes')
  fireEvent.change(lead, { target: { value: '30' } })
  fireEvent.blur(lead)

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/config/reminder_lead_minutes',
      expect.objectContaining({ method: 'POST' }),
    ),
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/Settings.test.tsx`
Expected: FAIL — no element with label `Reminder lead minutes`.

- [ ] **Step 3: Add the Reminders block to `Settings.tsx`**

Inside the Notifications `<Box>` (after the "Browser Notifications" block, before its closing `</Box>` at line ~311), add a sibling reminders block. First add config query + mutation near the top of `SettingsView` (after the `useState` hooks):

```tsx
  const qc = useQueryClient()
  const { data: cfg = {} as Record<string, string> } = useQuery({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then((r) => r.json()),
  })
  const saveCfg = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => setConfig(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  })
  const reminderOn = cfg.reminder_enabled !== '0'
  const leadMin = cfg.reminder_lead_minutes ?? '15'
```

Add `setConfig` to the `@/api` import (line 19) alongside `getGuidance, deleteGuidance`.

Then the UI block (uses `ToggleButtonGroup`/`ToggleButton`/`TextField`, all already imported):

```tsx
            {/* Reminders */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                Reminders
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <ToggleButtonGroup
                  value={reminderOn ? 'on' : 'off'}
                  exclusive
                  onChange={(_e, v) => {
                    if (v !== null) saveCfg.mutate({ key: 'reminder_enabled', value: v === 'on' ? '1' : '0' })
                  }}
                >
                  <ToggleButton value="on" aria-label="reminders on">On</ToggleButton>
                  <ToggleButton value="off" aria-label="reminders off">Off</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  type="number"
                  size="small"
                  label="Lead (min)"
                  defaultValue={leadMin}
                  key={leadMin}
                  disabled={!reminderOn}
                  onBlur={(e) => {
                    const n = Math.max(1, Number(e.target.value) || 15)
                    saveCfg.mutate({ key: 'reminder_lead_minutes', value: String(n) })
                  }}
                  slotProps={{ htmlInput: { min: 1, 'aria-label': 'Reminder lead minutes' } }}
                  sx={{ width: 130 }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                Notify this many minutes before deadlines, tasks, events, and news items come due.
              </Typography>
            </Box>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/views/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: no type errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/Settings.tsx frontend/src/views/Settings.test.tsx
git commit -m "feat(reminders): Settings controls for reminder on/off + lead minutes

On/off toggle and lead-minutes field write reminder_enabled and
reminder_lead_minutes via setConfig; copy explains what fires."
```

---

## Self-Review

**Spec coverage:**
- Config keys + defaults → Task 1 Step 5 (allowlist) + Task 2 (UI) + `.get` defaults in scan. ✓
- Worker scan over 4 tables, dedup, warning insert → Task 1 Steps 3–4. ✓
- Signals excluded → not in `_REMINDER_SOURCES`; noted in comment. ✓
- Broaden delivery filter → Task 1 Step 3. ✓
- Settings toggle + number → Task 2. ✓
- Test cases (in-window / dedup / outside-window / disabled) → Task 1 Step 1 + one 4-source test. ✓
- No schema migration / no new tables → confirmed; only `WRITABLE_CONFIG` edit. ✓

**Placeholder scan:** none — all code shown. The frontend test references the file's existing render helper (`renderSettings`); the implementer uses whatever wrapper `Settings.test.tsx` already defines rather than a fabricated one. This is the one intentional adapt-to-existing point, not a placeholder for logic.

**Type consistency:** `generate_due_reminders(conn) -> int` used identically in worker and tests. `source_table` tags `deadline/task/event/news` identical across scan SQL, insert, and assertions. `setConfig(key, value)` matches `api.ts:241`. Config keys spelled `reminder_enabled` / `reminder_lead_minutes` everywhere.
