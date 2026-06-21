---
name: trending_search
description: Weekly web/news search for trending content per topic; upsert trend_findings
schedule: automation, weekly Friday 14:00 EST
---

## Lookback window
Fixed window: last 7 days (for context), but this skill searches **current** trending results (not historical).

## Gather active topics
Query `SELECT * FROM topics WHERE active=1 ORDER BY priority, name`. For each topic:

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
1. Query `SELECT * FROM trend_findings WHERE external_ref=?` with the URL.
2. If found, skip (already logged).
3. Respect a per-run cap: `topics.max_suggest` (default 5) items per topic per run.
   - If cap reached for a topic, stop adding items for that topic and note in `skill_runs.note`.

## Map to existing trends (optional)
For each finding, attempt to map it to an existing `trends` row:
- Extract the trend term(s) most relevant to the article.
- Query `trends WHERE term=? AND window_start >= now - config.trend_window_days LIMIT 1`.
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
```
INSERT INTO skill_runs (
  skill, ran_at, window_start, window_end, items_created, status, note
) VALUES (
  'trending_search',
  datetime('now'),
  datetime('now', '-7 days'),
  datetime('now'),
  <findings_count>,
  'ok',
  '<topics_searched> topics searched; <dedup_count> deduplicated; <capped_topics> topics hit cap'
)
```

Then exit.
