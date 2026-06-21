---
name: extract_research_training_email
description: Identify training opportunities and research announcements in email; upsert learning items
schedule: heartbeat 30m, workdays 07:00-18:00 EST
---

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists, use `now - heartbeat_minutes` (default 30 min). Query Scout's email connector for messages received in `[window_start, now]`.

## Gather research and training signals
Scan email for:
1. **Training opportunities** — webinars, videos, online courses, F2F events, certification programs, conference registrations. Keywords: "webinar", "register", "attend", "training", "workshop", "seminar", "video tutorial", "course".
2. **Research announcements** — new products, technologies, resources, breakthroughs, industry reports. Keywords: "new", "launched", "released", "breakthrough", "study", "whitepaper", "report", "announcement".

For each flagged email, extract:
- `title`: email subject or headline
- `synopsis`: first 3-5 sentences describing the opportunity/announcement
- `kind`: classification as 'webinar' | 'video' | 'course' | 'f2f' (for training) or 'read' (for research/announcements)
- `provider`: organizer/company name if identifiable
- `event_at`: scheduled date/time if given (ISO-8601 UTC); leave null for self-paced content
- `url`: registration link or resource link if available
- `external_ref`: message-id (required for dedup)
- `topic_id`: map to `topics` by keyword match if relevant (e.g., "AI" email → topics where name like "%AI%"); leave null if no match

## Write learning items
For each email, compute `external_ref = message-id`. Then:
```
INSERT INTO learning (
  kind, source, external_ref, title, synopsis, url, provider, event_at, 
  topic_id, relevance, status
) VALUES (?, 'email', ?, ?, ?, ?, ?, ?, ?, 3, 'suggested')
ON CONFLICT(external_ref) DO NOTHING
```

Relevance defaults to 3 (normal relevance). If the item exactly matches an active topic, set relevance=2.

## No-op and log
If no new training/research emails in window, write a `skill_runs` row with `items_created=0` and exit.

If items created, write:
```
INSERT INTO skill_runs (skill, ran_at, window_start, window_end, items_created, status, note)
VALUES ('extract_research_training_email', datetime('now'), ?, datetime('now'), <count>, 'ok', NULL)
```

Then exit.
