---
name: suggest_events
description: Read signals implying meetings; suggest calendar times and attendees; draft events
schedule: heartbeat 30m
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists (first run), use `now - 24h`.

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
Call the **`add_event`** tool:

`add_event(title=…, body=…, proposed_times="[iso, iso, …]", attendees="[person_id, …]", status="suggested", source_signal_id=<signal id>)`

Dedup first: `query("events", filters=[["source_signal_id","=",<signal id>]])` — skip if a row already exists for this `source_signal_id`.

Deduplicate: do not insert if an `events` row already exists with the same `source_signal_id`.

## No-op and log
If no meeting-implied signals in window, log the run with `items_created=0` and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="suggest_events", items_created=<count>, status="ok", note=None)`

Then exit.
