---
name: compute_trends
description: Daily extraction of trending keywords/topics from signals; compute recency-weighted scores and deltas
schedule: automation, daily 08:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Fixed window: `[now - config.trend_window_days, now]` (default: last 7 days).

## Gather items
Query items in the window:
1. `query("signals", since=window_start, until=now)`
2. `query("learning", since=window_start, until=now)`

For each item, concatenate: `title + summary + (body or synopsis)` as the text to extract keywords from.

## Extract keywords / topics / entities
For each item text:
1. **LLM pass (or keyword extraction)**: extract 3-5 significant terms/topics/entities per item.
   Examples: "AI agents", "budget planning", "remote work", "Satya Nadella"
2. Normalize: lowercase, deduplicate, filter out common stop-words.
3. Classify each term: 'keyword' (generic), 'topic' (domain), or 'entity' (person/org).

## Aggregate across window
For each unique term:
1. **Raw count**: how many items mention it in the window.
2. **Recency weighting**: items from today weigh 1.0, items from 6 days ago weigh ~0.1.
   Formula: `score = sum(1 / (1 + days_ago)^2) for each mention`
3. **Compute delta**: compare `score` against the **prior window's row** with the same term.
   - If prior score is 0 or missing → delta='rising'
   - If prior score < current by >20% → delta='rising'
   - If prior score ≈ current (within ±20%) → delta='flat'
   - If prior score > current by >20% → delta='falling'

## Vector enrichment (optional upgrade)
If `config.embed_model` is set AND the embedding model is available:
1. Embed the term with the model (e.g., all-MiniLM-L6-v2 → 384-dim float vector).
2. **Dedup via ANN**: query `vec_trends` for similar embeddings (cosine similarity > 0.85).
   - If a close match exists, merge: use the higher-scoring term as the canonical, accumulate count + score.
   - If no match, store the new embedding.

**ponytail:** if the embedding model or sqlite-vec is unavailable, skip step 2 and proceed with count-based trends. Graceful degrade, never fail the run.

## Write trends
For each unique term (post-merge if deduped), call the `upsert_trend` tool to update the `trends` table:
- `term`: the normalized keyword/topic/entity
- `kind`: 'keyword' | 'topic' | 'entity'
- `score`: recency-weighted score
- `count`: raw occurrence count
- `delta`: 'rising' | 'flat' | 'falling'
- `sources`: JSON object mapping table names to item IDs that contributed (e.g., `{"signals": [1, 5, 12], "learning": [3]}`)
- `window_start`, `window_end`: the computation window
- `first_seen`: timestamp of earliest mention ever (or null if new)
- `last_seen`: timestamp of most recent mention in this window
- `embedding`: the float32 vector (if vectorized), or null

## Call log_skill_run
Write to the `skill_runs` table via the `log_skill_run` tool:
Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="compute_trends", items_created=<count>, status="ok", note="<items> analyzed; <merges> deduped (or count-based if no embeddings)")`

Then exit.
