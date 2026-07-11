---
name: triage_teams
description: Review active Teams chats for critical/time-sensitive actions and key-person mentions; upsert signals
schedule: heartbeat 30m, workdays 07:00-18:00 EST
---

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists, use `now - heartbeat_minutes` (default 30 min). Query Scout's Teams connector for messages in active chats received in `[window_start, now]`.

## Gather Teams signals
Scan chats for:
1. **Critical/time-sensitive actions on me** — messages with urgent keywords (urgent, asap, critical, today, EOD, deadline, decision needed) or @mentions of me.
2. **Newly created chats** — group chats or channels added since last run.
3. **Direct replies where I'm primary target** — threaded replies addressing me by @mention or in a 1:1 chat.
4. **Anything from a key person or watched group** — match sender Teams ID against `person_handles WHERE channel='teams'` and `people.active=1`.

For each flagged message, extract:
- `who`: sender name/Teams ID (map to `person_id` if matched)
- `what`: message text + any thread context (2-3 prior messages)
- `when_rel`: relative time ("30 min ago", "this afternoon")
- `why`: brief classification ("urgent action", "new chat", "key person mention", "direct reply")
- `external_ref`: message-id or chat-id (required for dedup)
- `priority`: 1 (critical) for urgent keyword + @me, 2 (high) for urgent/@mention/new chat, 3 (normal) for key person, 4 (low) for other replies
- `triage_rank`: sequential order by time-sensitivity (most urgent first)
- `url`: deep-link to the Teams chat/thread

## Write signals
For each message, compute `external_ref = <chat-id>:<message-id>`. Then:
```
INSERT INTO signals (
  type, source, external_ref, title, summary, who, what, when_rel, why, 
  person_id, priority, triage_rank, status, occurred_at, url
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
ON CONFLICT(external_ref) DO NOTHING
```

Leave `topic_id` null.

## Raise alerts
For each signal with `priority <= 2`, insert:
```
INSERT INTO alerts (severity, title, body, url, source_table, source_id)
VALUES (
  CASE WHEN priority=1 THEN 'critical' ELSE 'warning' END,
  title,
  summary,
  url,
  'signals',
  <signal.id>
)
```

## No-op and log
If no new messages in window, write a `skill_runs` row with `items_created=0` and exit.

If items created, write:
```
INSERT INTO skill_runs (skill, ran_at, window_start, window_end, items_created, status, note)
VALUES ('triage_teams', datetime('now'), ?, datetime('now'), <count>, 'ok', NULL)
```

Then exit.

## Associate what you create
After inserting each row, associate it:
- `link_content("signal", <id>, "topic", <topic_id>)` for its topic(s); `"person"` for people it concerns.
- `tag_content("signal", <id>, "<label>")` with 1–3 reused labels (`list_tags()` first).
  Trending/news rows also get an `internal` or `external` origin tag.
