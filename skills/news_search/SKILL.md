---
name: news_search
description: Search current headlines per topic; add news_items (deduped), tagged external + linked to topic/people
schedule: automation, daily 06:30 EST
---

## Scope
Covers general industry headlines, **competitive intelligence** (competitor moves, product
launches, funding, wins/losses), and **Teams community feed digests that arrive via email**
(channel/community summary emails forwarded or delivered to the inbox). Treat all three as
the same news pipeline — same extraction, dedup, and relevance rules below.

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Gather active topics
Read active topics with the **`query`** tool: `query("topics", filters=[["active","=",1]], order="priority")`. For each topic:

## Search current headlines
Perform a news/web search for recent articles in the topic area (last 3 days where the
engine supports date filtering), **including competitor-focused queries** (e.g. "<topic>
competitor" or a tracked competitor's name) so competitive-intelligence items surface
alongside general headlines. Extract the top results (respect `topics.max_suggest`,
default 5, per topic per run).

Also check the mailbox for **Teams community/channel digest emails** (subject lines like
"Community digest", "Channel summary", weekly community roundups) received since the last
run. Extract each linked article/post the same way as a search result below — these count
toward the same per-topic cap.

For each article or digest link, extract: `title`, `url`, `synopsis` (first 2–3 sentences),
`event_at` (publish time if known), `relevance` (1 exact → 5 tangential).

## Deconflict + insert
1. `external_ref` = the article url. Skip if a news item with that url already exists.
2. Call `add_news(title=…, url=…, external_ref=url, synopsis=…, topic_id=<topic id>,
   event_at=…, relevance=…, source="news", source_skill="news_search")`.

## Associate what you create
After inserting each news row (id returned by add_news):
- `link_content("news", <id>, "topic", <topic_id>)`; add `link_content("news", <id>, "person", <person_id>)` for any people the article concerns.
- `tag_content("news", <id>, "external")` (news is external-origin); add 1–2 subject labels (`list_tags()` first, reuse existing).

## Log the run
Call `log_skill_run("news_search", items_created=<n>, status="ok")`.
