---
name: trending_search
description: Weekly web/news search for trending content per topic; upsert trend_findings
schedule: automation, weekly Friday 14:00 EST
---

## MCP server
This skill runs entirely through the Scout **MCP server** at `http://127.0.0.1:8766`
(default port; bearer token `EA_MCP_TOKEN`). Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Fixed window: last 7 days (for context), but this skill searches **current** trending results (not historical).

## Gather active topics
Read active topics with the **`query`** tool: `query("topics", filters=[["active","=",1]], order="priority")`. For each topic:

## Web search for trending
Perform a **web search** (+ optional news search) for trending/current content in the topic area:
- Examples: topic="AI agents" → search "trending AI agents 2024" or "latest AI agent developments"
- Filter results to last 7 days (where search engine supports date filtering).
- Extract top 10–15 results (by relevance to the topic).

For each result, extract:
- `title`: article headline
- `synopsis`: first 2–3 sentences
- `url`: article link
- `source`: 'web' | 'news' (based on search source)
- `relevance`: score 1 (exactly matches topic) → 5 (tangentially related)
- `external_ref`: url (required for dedup)

## Deconflict against existing trend_findings
Before inserting:
1. Check for an existing finding with the **`query`** tool: `query("trend_findings", filters=[["external_ref","=",<url>]])`.
2. If found, skip (already logged).
3. Respect a per-run cap: `topics.max_suggest` (default 5) items per topic per run.
   - If cap reached for a topic, stop adding items for that topic and note in `skill_runs.note`.

## Map to existing trends (optional)
For each finding, attempt to map it to an existing `trends` row:
- Extract the trend term(s) most relevant to the article.
- Look up a matching recent trend with the **`query`** tool: `query("trends", filters=[["term","=",<term>]], limit=1)`.
- If found, store `trend_id` in the finding (links the finding to the trend).
- If not found, leave `trend_id=NULL` (the finding stands alone).

## Write trend_findings
For each non-deduped result, call the `add_trend_finding` tool to insert into the `trend_findings` table:
- `trend_id`: ID of a matching trend (if found), or null
- `topic_id`: the topic's ID
- `title`: article headline
- `synopsis`: first 2–3 sentences
- `url`: article link
- `source`: 'web' | 'news'
- `external_ref`: URL (for dedup)
- `relevance`: 1–5 score

## Call log_skill_run
Call the `log_skill_run` tool to write:
Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="trending_search", items_created=<count>, status="ok", note="<topics> searched; <dedup> deduped; <capped> hit cap")`

Then exit.

## Associate what you create
After inserting each row, associate it:
- `link_content("trend_finding", <id>, "topic", <topic_id>)` for its topic(s); `"person"` for people it concerns.
- `tag_content("trend_finding", <id>, "<label>")` with 1–3 reused labels (`list_tags()` first).
  Trending/news rows also get an `internal` or `external` origin tag.
