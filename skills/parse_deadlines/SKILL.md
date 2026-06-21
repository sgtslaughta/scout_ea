---
name: parse_deadlines
description: Scan signals and email/chat for hard deadlines; upsert critical_deadlines
schedule: heartbeat 30m, workdays 07:00-18:00 EST
---

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists, use `now - heartbeat_minutes` (default 30 min).

## Gather deadline signals
Scan:
1. **Signals** created since last run (`signals.created_at >= window_start`)
2. **New email** from Scout's email connector since last run
3. **New Teams messages** from Scout's Teams connector since last run

For each source, flag content containing **hard dates / deadlines**:
- Keywords: "due", "deadline", "by", "before", "submit", "deliver", "complete by", "EOD Friday", "end of business", "must have by", "by next week"
- Relative dates: "EOD today", "by Friday", "next Monday"
- Absolute dates: ISO dates, "December 15", "Q2 end", "fiscal year end"

For each flagged item, extract:
- `title`: short deadline summary (e.g., "Q2 budget submission")
- `detail`: full context from the source (email body excerpt, chat message, signal body)
- `due_at`: resolved to absolute UTC ISO-8601 datetime
  - For relative dates (EOD Friday), resolve to the next occurrence of that day at `config.work_hours` end (e.g., 18:00 EST)
  - Use `config.tz` for local-to-UTC conversion
- `source`: 'email' | 'teams' | (manual entries via the UI are 'manual')
- `external_ref`: message-id / chat-id (required for dedup); manual entries get 'manual:<uuid>'
- `person_id`: if the source is from a known person, map via `person_handles`
- `signal_id`: if parsed from a signal, store the signal's ID
- `priority`: default 2 (high); escalate to 1 (critical) if urgent keywords present

## Write critical_deadlines
For each deadline, compute `external_ref` from source. Then:
```
INSERT INTO critical_deadlines (
  title, detail, due_at, source, external_ref, person_id, signal_id, priority, visible, status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')
ON CONFLICT(external_ref) DO NOTHING
```

`visible=1` by default (can be toggled by the user on `/deadlines`).

## Raise alerts
For each deadline with `priority <= 2`, insert:
```
INSERT INTO alerts (severity, title, body, url, source_table, source_id)
VALUES (
  CASE WHEN priority=1 THEN 'critical' ELSE 'warning' END,
  title,
  detail,
  NULL,
  'critical_deadlines',
  <deadline.id>
)
```

## No-op and log
If no new deadlines in window, write a `skill_runs` row with `items_created=0` and exit.

If deadlines parsed, write:
```
INSERT INTO skill_runs (skill, ran_at, window_start, window_end, items_created, status, note)
VALUES ('parse_deadlines', datetime('now'), ?, datetime('now'), <count>, 'ok', NULL)
```

Then exit.
