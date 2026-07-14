---
name: research_topics
description: Weekly web/news search for developments in active topics; upsert learning items
schedule: automation, weekly Friday 09:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Timeframe: last 7 days (fixed window, not anchored to `skill_runs` for this automation).

## Gather active topics
Read active topics with the **`query`** tool: `query("topics", filters=[["active","=",1]], order="priority")`. For each topic, perform:

## Web search for developments
For each active topic:
1. Conduct a **web search** for recent news/articles about the topic (e.g., "AI agents" → search "AI agents 2024" or "latest breakthroughs in AI agents")
2. Filter to sources published in the last 7 days.
3. Extract top 5–10 results (by relevance).

For each result, extract:
- `title`: article headline
- `synopsis`: first 2–3 sentences of the article
- `url`: article link
- `kind`: 'read' (classification for web content)
- `relevance`: score 1 (highly relevant) → 5 (tangentially related) based on keyword match and recency
- `external_ref`: url (required for dedup)

## Deconflict against existing learning
Before inserting a `learning` row:
1. Check for an existing item with the **`query`** tool: `query("learning", filters=[["external_ref","=",<article url>]])`.
2. If found, skip (already logged).
3. Respect caps:
   - Per-topic: `topics.max_suggest` (default 5) new items per run
   - Global: `config.global_max_suggest` (default 25) total items across all topics per run
   - If either cap reached, stop adding items and note it in the `skill_runs.note`.

## Write learning items
For each non-deduped result, call the **`add_learning`** tool:
- `kind`: 'read'
- `source`: 'web'
- `external_ref`: article URL (for dedup)
- `title`: article headline
- `synopsis`: first 2–3 sentences
- `url`: link
- `provider`: news source domain
- `topic_id`: the topic's ID
- `relevance`: 1–5 score
- `status`: 'suggested'

## Call log_skill_run
If no results or all deduped, call the `log_skill_run` tool to write:
Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="research_topics", items_created=<count>, status="ok", note="<count> added; caps/dedup noted")`

Then exit.

## Associate what you create
After inserting each row, associate it:
- `link_content("signal", <id>, "topic", <topic_id>)` for its topic(s); `"person"` for people it concerns.
- `tag_content("signal", <id>, "<label>")` with 1–3 reused labels (`list_tags()` first).
  Trending/news rows also get an `internal` or `external` origin tag.
