---
name: triage_email
description: Review inbound email for critical/time-sensitive actions, events, and key-person replies; upsert signals
schedule: heartbeat 30m, workdays 07:00-18:00 EST
---

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists, use `now - heartbeat_minutes` (default 30 min). Query Scout's email connector for messages received in `[window_start, now]`.

## Gather email signals
Scan inbox for:
1. **Critical/time-sensitive actions on me** — messages with urgent keywords (urgent, asap, critical, today, EOD, deadline, decision needed) or marked important.
2. **New events/invites/meeting requests** — meeting proposals, calendar invitations, rsvp requests.
3. **Direct replies where I'm primary target** — in-reply-to chains where I'm the addressee or main cc, not bcc.
4. **Anything from a key person** — match sender email against `person_handles WHERE channel='email'` and `people.active=1`.

For each flagged email, extract:
- `who`: sender name/email (map to `person_id` if matched)
- `what`: email subject + first 2 lines of body
- `when_rel`: relative time ("2h ago", "this morning")
- `why`: brief classification ("meeting request", "budget decision", "key person update", "urgent action")
- `external_ref`: message-id (required for dedup)
- `priority`: 1 (critical) for urgent keyword + key person, 2 (high) for events/urgent, 3 (normal) for key person, 4 (low) for other replies
- `triage_rank`: sequential order by time-sensitivity (most urgent first)

## Write signals
For each email, compute `external_ref = message-id`. Then:
```
INSERT INTO signals (
  type, source, external_ref, title, summary, who, what, when_rel, why, 
  person_id, priority, triage_rank, status, occurred_at, url
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
ON CONFLICT(external_ref) DO NOTHING
```

Set `url` to Scout's Outlook deep-link to the message (if available). Leave `topic_id` null.

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
If no new emails in window, write a `skill_runs` row with `items_created=0` and exit.

If items created, write:
```
INSERT INTO skill_runs (skill, ran_at, window_start, window_end, items_created, status, note)
VALUES ('triage_email', datetime('now'), ?, datetime('now'), <count>, 'ok', NULL)
```

Then exit.

## Associate what you create
After inserting each row, associate it:
- `link_content("signal", <id>, "topic", <topic_id>)` for its topic(s); `"person"` for people it concerns.
- `tag_content("signal", <id>, "<label>")` with 1–3 reused labels (`list_tags()` first).
  Trending/news rows also get an `internal` or `external` origin tag.
