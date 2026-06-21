---
name: suggest_events
description: Read signals implying meetings; suggest calendar times and attendees; draft events
schedule: heartbeat 30m
---

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists, use `now - heartbeat_minutes` (default 30 min).

## Gather meeting signals
Query `list_rows('signals', status='new')` for signals created in `[window_start, now]` where the content implies a meeting or sync:
- Keywords: "sync", "meeting", "call", "discussion", "alignment", "debrief", "review", "walk-through", "standup"
- Extracted action: "schedule a meeting" or similar in the 5 W's
- Signals with `type='email'` containing meeting request language

For each candidate signal, extract:
- `attendees`: resolve names/emails to `people.id` list (from `who` field or email/Teams context)
- `duration`: infer from context (default 30 min for syncs, 60 min for reviews)
- `signal_id`: the source signal's ID

## Suggest calendar times
For each meeting candidate:
1. Query my calendar free/busy for the next 7 days (via Scout's calendar connector).
2. Within `config.work_hours` and `config.work_days`, propose **≥3** non-overlapping slots.
3. Prefer morning slots (earlier in the day is higher priority).
4. Format proposed times as JSON array of ISO-8601 UTC datetimes.

## Draft event
For each candidate, insert one `events` row:
```
INSERT INTO events (
  title, body, proposed_times, attendees, status, source_signal_id
) VALUES (
  <signal.title>,
  <signal.summary>,
  '[ISO-datetime, ISO-datetime, ...]',  -- JSON array, >=3 slots
  '[person_id, person_id, ...]',        -- JSON array
  'suggested',
  <signal.id>
)
```

Deduplicate: do not insert if an `events` row already exists with the same `source_signal_id`.

## No-op and log
If no meeting-implied signals in window, write a `skill_runs` row with `items_created=0` and exit.

If events suggested, write:
```
INSERT INTO skill_runs (skill, ran_at, window_start, window_end, items_created, status, note)
VALUES ('suggest_events', datetime('now'), ?, datetime('now'), <count>, 'ok', NULL)
```

Then exit.
