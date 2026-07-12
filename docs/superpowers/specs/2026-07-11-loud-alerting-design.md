# Loud Alerting (SP-B3) — Design

**Date:** 2026-07-11
**Status:** Approved (brainstorm)
**Program:** SP-B Reminders/Alerts — sub-project 3 of 3. Siblings (not yet scoped):
SP-B1 productivity timers, SP-B2 recurring interval alarms. This spec covers **B3 only**.

## Goal

Make genuinely urgent alerts hard to miss: repeat the browser push until the user
acknowledges (bounded), keep the notification on screen in the background, and play a
foreground chime when the app is open. Builds entirely on the alerts + web-push pipe
already shipped (Timeline Reminders). One new column, no new tables.

## Platform constraint (shapes the design)

Web Push service-worker notifications **cannot play a custom sound file** cross-browser —
the OS owns notification audio. So sound splits by context:

- **Foreground (tab open):** full control via Web Audio → a short oscillator chime, no asset.
- **Background (tab closed, push):** OS default sound + `requireInteraction` keeps the
  notification on screen until dismissed. No custom audio possible.

This is accepted, not worked around.

## Configuration

Two `config` KV keys, both added to `WRITABLE_CONFIG` (no migration for config — KV table):

- `alert_loud_threshold` ∈ `off` | `critical` | `warning`, default `critical`.
  Severity set that qualifies as "loud":
  - `off` → feature disabled (no repeat, no loud payload, no chime).
  - `critical` → `{critical}`.
  - `warning` → `{warning, critical}`.
- `alert_sound_enabled` ∈ `"1"` | `"0"`, default `"1"` — foreground chime on/off.

Severity vocabulary in the app is `info` / `warning` / `critical`. `info` is never loud.

## Schema

Add one column to `alerts`:

```sql
repeat_count INTEGER NOT NULL DEFAULT 0
```

- Fresh DBs: add to the `alerts` table definition in `backend/ea/schema.sql`.
- Existing DBs: add an idempotent block to `_migrate(conn)` in `backend/ea/db.py:34`
  following the existing `PRAGMA table_info` + `ALTER TABLE ... ADD COLUMN` pattern.

No `last_pushed_at` column: cadence is anchored on the existing `updated_at`, which the
`trg_alerts_touch` trigger already bumps on every write (including each repeat's
`repeat_count` update).

## Backend

### Repeat engine

New `repush_loud_alerts(conn) -> int` in `backend/lib/push.py`, called by the worker loop
**after** `push_pending_alerts`:

```
push.generate_due_reminders(conn)   # existing (reminders)
push.push_pending_alerts(conn)      # existing initial send (now with loud payload)
push.repush_loud_alerts(conn)       # NEW: bounded repeats for unacked loud alerts
```

Constants in `push.py`: `LOUD_REPEAT_MINUTES = 5`, `LOUD_REPEAT_MAX = 2` (initial send +
2 repeats = 3 notifications total).

Logic:
1. Read `alert_loud_threshold` from config; if `off`, return 0. Resolve the severity set.
2. Select alerts where:
   `status='unread' AND severity IN (<threshold set>) AND notified_push=1
    AND repeat_count < LOUD_REPEAT_MAX
    AND datetime('now') >= datetime(updated_at, '+<LOUD_REPEAT_MINUTES> minutes')`.
   (`notified_push=1` guarantees the initial send already happened; `status='unread'` is
   the acknowledgement gate — any move off unread stops repeats.)
3. For each: `send_push(...)` with the loud payload (below), then
   `UPDATE alerts SET repeat_count = repeat_count + 1 WHERE id=?` (trigger re-anchors
   `updated_at`, spacing the next repeat by 5 min).
4. Return count resent.

Threshold-set resolution is shared with the payload logic — extract one helper
`_loud_severities(conn) -> set[str]` (returns `set()` when `off`) so both call sites agree.

### Loud payload

`send_push` currently sends `{title, body}`. Extend the payload to
`{title, body, loud: bool, tag: str}`:

- Add optional `loud` and `tag` parameters to `send_push(conn, title, body, loud=False,
  tag=None, claims_email=...)`; include them in the JSON payload.
- `push_pending_alerts`: compute `loud = severity IN _loud_severities(conn)` per alert (so
  the initial send is already loud when it qualifies) and pass `tag=f"alert-{id}"`. It must
  therefore select `id, severity` too.
- `repush_loud_alerts`: always `loud=True`, `tag=f"alert-{id}"` (all its rows are loud).

`tag` lets the service worker collapse an alert's repeats into one on-screen notification
(`renotify` re-alerts without stacking duplicates).

## Frontend

### Service worker (`frontend/public/sw.js`)

In the `push` handler, when `data.loud` is true, add notification options
`requireInteraction: true, renotify: true, tag: data.tag`. Non-loud notifications keep
current behavior (add `tag: data.tag` harmlessly if present, but no `requireInteraction`).

To make this testable, extract the options object into a pure function
`buildNotificationOptions(data)` in the same file (or a tiny sibling module the SW
imports via `importScripts`) and unit-test that function — the event wiring stays a thin
shell around it.

### Foreground chime (`useAlertChime`)

New hook `frontend/src/lib/useAlertChime.ts`:

- Consumes the existing alerts query (already refreshed live by the SSE `db-changed`
  stream) and the `config` query (`alert_loud_threshold`, `alert_sound_enabled`).
- Tracks the highest alert `id` seen across renders (ref). When the alert list gains a new
  alert with a greater id that is `status==='unread'` and whose severity is in the loud set
  and `alert_sound_enabled !== '0'`, play a ~150ms Web Audio oscillator beep.
- Web Audio only (`new AudioContext()` → oscillator → gain envelope). No asset file. Guard
  for browsers without `AudioContext`. First play may require a prior user gesture (browser
  autoplay policy) — acceptable; the chime is best-effort, the notification is the
  guaranteed channel.
- Mounted once high in the app tree (where the alerts query already lives). It renders
  nothing.

### Settings ("Alert urgency" group)

Add a group to `frontend/src/views/Settings.tsx`, reusing the config query + `setConfig`
mutation pattern already added for reminders:

- Threshold select (native, like the timezone control): Off / Critical / Critical +
  Warning → writes `alert_loud_threshold` as `off` / `critical` / `warning`.
- Sound toggle (ToggleButtonGroup On/Off) → writes `alert_sound_enabled` `"1"`/`"0"`,
  disabled when threshold is `off`.
- One line of copy explaining repeat-until-acknowledged (every 5 min, up to 3 times).

## Acknowledgement

No new endpoint. The generic `POST /api/{table}/{row_id}/status` already targets `alerts`
(`alerts` ∈ `_STATUS_TABLES`), and Quickdraw's NeedsResponse already exposes
silence/dismiss actions that move an alert off `status='unread'`. That is the ack: repeats
stop immediately because the repush query filters `status='unread'`.

## Data flow

```
worker tick (30s):
  generate_due_reminders            # reminders (existing)
  push_pending_alerts               # initial send; loud+tag when severity qualifies
  repush_loud_alerts                # +≤2 repeats of unacked loud alerts, 5 min apart

tab open (foreground):
  SSE db-changed → alerts refetch → useAlertChime sees new unread loud alert → Web Audio beep

tab closed (background):
  push event → buildNotificationOptions(data): loud ⇒ requireInteraction + renotify + tag
  notificationclick → focus/open app

user acks (silence/dismiss in NeedsResponse):
  status leaves 'unread' → repush query no longer matches → repeats stop
```

## Error handling

- Worker already wraps each tick in try/except; `repush_loud_alerts` inherits it.
- Bad/absent config → `_loud_severities` returns `{critical}` for unknown non-`off` values?
  No — treat only the three known values; any unrecognized value falls back to the default
  `critical` set, and `off` is the sole disable. Missing key → default `critical`.
- `repeat_count` monotonic; cap `< LOUD_REPEAT_MAX` guarantees termination even if a row is
  never acked.
- Web Audio unavailable or blocked by autoplay policy → chime silently no-ops; notification
  path is unaffected.

## Testing

Backend (`backend/tests/test_loud_alerting.py`):
- `repush_loud_alerts` resends an unread critical alert whose `updated_at` is ≥5 min old and
  `notified_push=1`; increments `repeat_count`.
- Does not resend before 5 min elapsed (fresh `updated_at`).
- Stops at `repeat_count == LOUD_REPEAT_MAX`.
- Excludes acked (status ≠ 'unread') and below-threshold (e.g. `warning` when threshold
  `critical`) alerts.
- `off` threshold → returns 0, sends nothing.
- `push_pending_alerts` sets `loud=True` in the payload for a critical alert, `loud=False`
  for an `info` alert (assert on the recorded `webpush` payload JSON, monkeypatched as in
  `test_push.py`).
- `_migrate` adds `repeat_count` to a pre-existing DB lacking it (build a DB without the
  column, run `_migrate`, assert `PRAGMA table_info` shows it).

Frontend:
- `useAlertChime` triggers the beep once when a new unread loud alert appears; silent when
  `alert_sound_enabled='0'`, when severity is below threshold, and when the alert is already
  read. Mock `AudioContext` and assert oscillator start/stop calls.
- `buildNotificationOptions` returns `requireInteraction:true, renotify:true, tag` for loud
  input and omits `requireInteraction` for non-loud.
- Settings: changing the threshold select posts `alert_loud_threshold`; sound toggle posts
  `alert_sound_enabled` and is disabled when threshold is `off`.

## Files touched (est.)

- `backend/ea/schema.sql` — `repeat_count` on `alerts`.
- `backend/ea/db.py` — `_migrate` add-column block; `WRITABLE_CONFIG` += two keys.
- `backend/lib/push.py` — `_loud_severities`, `repush_loud_alerts`, `send_push` loud/tag
  params, `push_pending_alerts` loud payload.
- `backend/lib/push_worker.py` — call `repush_loud_alerts` in the loop.
- `frontend/public/sw.js` — `buildNotificationOptions` + loud options.
- `frontend/src/lib/useAlertChime.ts` — new hook.
- App root (wherever the alerts query is provided) — mount `useAlertChime`.
- `frontend/src/views/Settings.tsx` — Alert urgency group.
- Tests: `backend/tests/test_loud_alerting.py`, `useAlertChime` test, `sw` options test,
  `Settings.test.tsx` additions.

No new dependency. One new column. No new tables, no new endpoints.

## Out of scope

SP-B1 (timers) and SP-B2 (interval alarms) — separate specs. Per-alert custom sounds,
snooze, and email/SMS escalation — not in v1.
