---
name: compile_learning_email
description: Consolidate training/research emails from the week; compile summary
schedule: automation, weekly Friday 10:00 EST
---

## MCP server
This skill runs entirely through the Scout **MCP server** at `http://127.0.0.1:8766`
(default port; bearer token `EA_MCP_TOKEN`). Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Timeframe: last 7 days (fixed window).

## Gather this week's learning items
Query `list_rows('learning', status=?)` to find items marked as 'suggested' and created in the last 7 days where `source='email'`. For each:
- Extract `title`, `synopsis`, `provider`, `event_at`, `topic_id`, `kind`

## Deconflict duplicates
For each email-sourced learning item:
1. Check if a row with the same `title` or `url` already exists in `learning`.
2. If found and created within the last 2 weeks, skip (deduplicated).
3. Enrich: if `event_at` is null but the email mentions a date, parse and populate.

## Compile summary
Organize items by:
- Training events (scheduled `event_at`): group by date
- Self-paced resources (video, course, read): group by topic
- Create a text summary (markdown format) listing:
  - "Training this week: [list with dates]"
  - "New resources by topic: [topic]: [item1], [item2]"
  - Links to full details

## Write consolidation
Set all compiled items' status to 'suggested' (if not already). No new `learning` row is created for the consolidation itself; this skill just ensures flagged items are ready for the user to review via the `/learning` page.

## Optional: fire alert
If > 3 new training items, optionally insert a low-priority info alert: "New training opportunities this week: <count> items ready to review".

## Call log_skill_run
Write to the `skill_runs` table via the `log_skill_run` tool:
Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="compile_learning_email", items_created=<count>, status="ok", note="week reviewed; <count> items consolidated")`

Then exit.

## Associate what you create
After inserting each row, associate it:
- `link_content("learning", <id>, "topic", <topic_id>)` for its topic(s); `"person"` for people it concerns.
- `tag_content("learning", <id>, "<label>")` with 1–3 reused labels (`list_tags()` first).
  Trending/news rows also get an `internal` or `external` origin tag.
