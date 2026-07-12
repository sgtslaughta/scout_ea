# Timeline Reminders — Design

**Date:** 2026-07-11
**Status:** Approved (brainstorm)
**Program:** Outgoing Actions / post-SP3 backlog — the deferred "upcoming-item notification" track.

## Goal

Proactively notify the user a configurable lead time *before* a time-anchored item
comes due, using the web-push pipe that already exists end-to-end (VAPID, service
worker, `push_subscriptions`, `push_worker` loop, `push_pending_alerts`, `notified_push`
dedup). No new delivery machinery — only the "when to fire" logic and a setting.

## Scope

Reminders fire off a **future** time column. Four item types qualify:

| Table | Time column | Active filter |
|---|---|---|
| `critical_deadlines` | `due_at` (NOT NULL) | `status` active AND `visible` |
| `tasks` | `due_at` (nullable) | `status != 'done'`, `due_at NOT NULL` |
| `events` | `chosen_time` (nullable) | `status` confirmed, `chosen_time NOT NULL` |
| `news_items` | `event_at` (nullable) | `event_at NOT NULL` |

**Signals are out of scope** — their only timestamp `occurred_at` is in the past, so
there is nothing to count down to. Upcoming feed events are covered by `news_items.event_at`.

Exact active-status predicates are finalized during planning against each table's real
status vocabulary; the intent is "not already done/cancelled/dismissed, and time is in the future."

## Non-goals (v1)

- Per-item lead override (global default only).
- In-app sound / timer / stopwatch / alarm / multi-interval — that is the separate
  **SP-B Reminders/Alerts** track, still deferred.
- New per-item schema columns or new tables.

## Configuration

Two rows in the existing `config` KV table (no migration):

- `reminder_enabled` — `"1"`/`"0"`, default `"1"`.
- `reminder_lead_minutes` — integer string, default `"15"`.

Read by the worker each scan; set via Settings UI.

## Worker

New function `generate_due_reminders(conn)` in `backend/lib/push.py`, called by the
existing `push_worker` loop **before** `push_pending_alerts(conn)` each iteration.

Logic:

1. If `reminder_enabled` is off, return.
2. `lead = reminder_lead_minutes`.
3. For each of the 4 tables, select rows where
   `timecol BETWEEN datetime('now') AND datetime('now', '+<lead> minutes')`
   AND the active-status filter
   AND **no existing alert** already points at the row
   (`NOT EXISTS (SELECT 1 FROM alerts WHERE source_table=? AND source_id=?)`).
4. For each hit, `INSERT INTO alerts (severity, title, body, url, source_table, source_id)`
   with `severity='warning'`, a title like `"Due in 15 min: <item title>"`, and
   `source_table` set to a stable per-type tag (e.g. `deadline`, `task`, `event`, `news`).

Dedup rides the existing `alerts.source_table + source_id` — no new `notified_*` column
per item table. Once an alert row exists for an item, step 3 never re-creates it.

The 30 s poll *is* the scheduler: an item silently enters the lead window, the next scan
emits exactly one alert, dedup suppresses all later scans. No cron/APScheduler needed.

## Delivery

`push_pending_alerts` currently filters `severity='critical'`. Broaden to
`severity IN ('critical','warning')` so reminder rows are picked up. Everything downstream
(payload build, `send_push`, `notified_push=1` flip) is unchanged. This keeps the
`critical` tier clean while letting `warning`-level reminders reach the browser.

Reminder alerts also appear in the normal in-app alerts list (they are ordinary rows),
giving a consistent surface whether the tab is open or closed.

## Settings UI

Extend the existing Settings panel with a "Reminders" group:

- Toggle bound to `reminder_enabled`.
- Number input bound to `reminder_lead_minutes` (min 1).

Reuse the existing config fetch/set path (`api.ts` + `/api/config` or the equivalent used
by current settings). No new endpoints if the config KV is already exposed; otherwise add a
minimal GET/PUT for these two keys following the existing config route pattern.

## Data flow

```
push_worker loop (30s)
  └─ generate_due_reminders(conn)         # scan 4 tables, insert warning alerts (deduped)
  └─ push_pending_alerts(conn)            # severity IN (critical,warning), unread, notified_push=0
        └─ send_push(sub, {title, body})  # per push_subscriptions row
        └─ UPDATE alerts SET notified_push=1
```

## Error handling

- Worker already wraps each iteration in a broad try/except (loop never dies). New scan
  inherits that; a malformed row or bad config value logs and is skipped, not fatal.
- `reminder_lead_minutes` parsed defensively → fallback 15 on non-int.
- Insert is idempotent via the `NOT EXISTS` guard even if two scans race (single worker
  thread today, so no real contention; guard is belt-and-suspenders).

## Testing

One `backend/tests/test_reminders.py` (or repo's convention):

1. Seed a `critical_deadlines` row due in +10 min, lead=15.
   `generate_due_reminders` → assert exactly one `alerts` row, `severity='warning'`,
   correct `source_table`/`source_id`.
2. Run again → assert still one row (dedup).
3. Seed a deadline due in +2 h → assert no alert (outside lead window).
4. `reminder_enabled='0'` → assert no alert.

## Files touched (est.)

- `backend/lib/push.py` — `generate_due_reminders`; broaden `push_pending_alerts` filter.
- `backend/lib/push_worker.py` — call new fn in loop.
- Settings default seeding for the two config keys (wherever config defaults live).
- Config route — only if the KV keys aren't already GET/PUT-exposed.
- `frontend/src/…/Settings` — Reminders group (toggle + number).
- `frontend/src/lib/api.ts` — config getter/setter if not already present.
- `backend/tests/test_reminders.py` — new.

No schema migration. No new tables. No new dependency.
