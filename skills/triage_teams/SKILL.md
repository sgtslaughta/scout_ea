---
name: triage_teams
description: Review active Teams chats for critical/time-sensitive actions and key-person mentions; upsert signals
schedule: heartbeat 30m, workdays 07:00-18:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists (first run), use `now - 24h`. Query Scout's Teams connector for messages in active chats received in `[window_start, now]`.

## Gather Teams signals
Scan chats for:
1. **Critical/time-sensitive actions on me** — messages with urgent keywords (urgent, asap, critical, today, EOD, deadline, decision needed) or @mentions of me.
2. **Newly created chats** — group chats or channels added since last run.
3. **Direct replies where I'm primary target** — threaded replies addressing me by @mention or in a 1:1 chat.
4. **Anything from a key person or watched group** — match sender Teams ID against known handles via `query("person_handles", filters=[["channel","=","teams"]])`, limited to active people.

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
For each message, compute `external_ref = <chat-id>:<message-id>`. Then call the **`add_signal`** tool:

`add_signal(type="teams", source="teams", external_ref=…, title=…, summary=…, who=…, what=…, when_rel=…, why=…, person_id=…, priority=…, triage_rank=…, occurred_at=…, url=…)`

`status` defaults to `'new'`; the tool dedups on `external_ref` and returns the row id (1 new / 0 duplicate). Leave `topic_id` unset.

Leave `topic_id` null.

## Raise alerts
For each signal with `priority <= 2`:
Call the **`add_alert`** tool:

`add_alert(severity=("critical" if priority==1 else "warning"), title=…, body=…, url=…, source_table="signals", source_id=<row id>)`

## No-op and log
If no new messages in window, log the run with `items_created=0` and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="triage_teams", items_created=<count>, status="ok", note=None)`

Then exit.

## Associate what you create
After inserting each row, associate it:
- `link_content("signal", <id>, "topic", <topic_id>)` for its topic(s); `"person"` for people it concerns.
- `tag_content("signal", <id>, "<label>")` with 1–3 reused labels (`list_tags()` first).
  Trending/news rows also get an `internal` or `external` origin tag.
