---
name: extract_research_training_email
description: Identify training opportunities and research announcements in email; upsert learning items
schedule: heartbeat 30m, workdays 07:00-18:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists (first run), use `now - 24h`. Query Scout's email connector for messages received in `[window_start, now]`.

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
For each email, compute `external_ref = message-id`. Then call the **`add_learning`** tool:

`add_learning(kind=…, source="email", external_ref=…, title=…, synopsis=…, url=…, provider=…, event_at=…, topic_id=…, relevance=3, status="suggested")`

Dedups on `external_ref`.

Relevance defaults to 3 (normal relevance). If the item exactly matches an active topic, set relevance=2.

## No-op and log
If no new training/research emails in window, log the run with `items_created=0` and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="extract_research_training_email", items_created=<count>, status="ok", note=None)`

Then exit.

## Associate what you create
After inserting each row, associate it:
- `link_content("learning", <id>, "topic", <topic_id>)` for its topic(s); `"person"` for people it concerns.
- `tag_content("learning", <id>, "<label>")` with 1–3 reused labels (`list_tags()` first).
  Trending/news rows also get an `internal` or `external` origin tag.
