---
name: research_topics
description: Weekly web/news search for developments in active topics; upsert learning items
schedule: automation, weekly Friday 09:00 EST
---

## Lookback window
Timeframe: last 7 days (fixed window, not anchored to `skill_runs` for this automation).

## Gather active topics
Query `SELECT * FROM topics WHERE active=1 ORDER BY priority, name`. For each topic, perform:

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
1. Query `SELECT * FROM learning WHERE external_ref=?` with the article URL.
2. If found, skip (already logged).
3. Respect caps:
   - Per-topic: `topics.max_suggest` (default 5) new items per run
   - Global: `config.global_max_suggest` (default 25) total items across all topics per run
   - If either cap reached, stop adding items and note it in the `skill_runs.note`.

## Write learning items
For each non-deduped result, call the `add_signal` tool to insert into the `learning` table:
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
```
INSERT INTO skill_runs (
  skill, ran_at, window_start, window_end, items_created, status, note
) VALUES (
  'research_topics',
  datetime('now'),
  datetime('now', '-7 days'),
  datetime('now'),
  <count>,
  'ok',
  <note: caps hit? dedup count?>
)
```

Then exit.
