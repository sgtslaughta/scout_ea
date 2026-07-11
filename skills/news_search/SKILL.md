---
name: news_search
description: Search current headlines per topic; add news_items (deduped), tagged external + linked to topic/people
schedule: automation, daily 06:30 EST
---

## Gather active topics
Query `SELECT * FROM topics WHERE active=1 ORDER BY priority, name`. For each topic:

## Search current headlines
Perform a news/web search for recent articles in the topic area (last 3 days where the
engine supports date filtering). Extract the top results (respect `topics.max_suggest`,
default 5, per topic per run).

For each article, extract: `title`, `url`, `synopsis` (first 2–3 sentences),
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
