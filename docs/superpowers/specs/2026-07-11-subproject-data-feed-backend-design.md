# SP2 — Data Feed Backend (Data Feed program)

**Status:** approved 2026-07-11
**Program:** Data Feed overhaul — SP2 of 3 (SP1 tagging DONE → **SP2 backend** → SP3 newsroom UI).
**Goal:** Wire up Learning, add a News source, and expose a `/api/feed` aggregate so SP3's reactive Data Feed page has a complete, filterable backend. Content is associated via the SP1 universal tags/links system; internal/external origin is a tag, not a column.

## Why

Trending (`trends`/`trend_findings`), Topics (`topics`), and Learning (`learning`) tables exist, but Learning has no db helpers/endpoints and nothing writes it, and News has no home at all. SP2 fills those gaps and adds a thin aggregation layer so the SP3 page can render an overview and pivot into per-category lists filtered by tag/person/topic/origin — reusing SP1's association layer for all cross-references.

## Architecture

- **News** gets a thin first-class table (`news_items`) mirroring the `learning`/`trend_finding` shape, with its own read/archive status lifecycle and dedup key.
- **Learning** is wired up (list + write helpers + endpoints) against the existing table.
- **Populators**: new `add_learning`/`add_news_item` db helpers + MCP tools, since skills currently have no way to write these tables. A thin `news_search` skill prompt populates News.
- **Aggregation** lives in a new `lib/feed.py` (keeps `app.py` thin): an `overview()` and a shared `filter_ids()` used by the per-category list endpoints.
- **Origin** (internal/external) is an SP1 label-tag (`tag_content(ref_type, id, 'internal'|'external')`), filtered via `content_ids_by_tag`. No schema column.

## Data model — `features.sql` migration 007

```sql
CREATE TABLE IF NOT EXISTS news_items (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  url          TEXT,
  synopsis     TEXT,
  external_ref TEXT UNIQUE,                    -- dedup key (usually the url)
  topic_id     INTEGER REFERENCES topics(id),
  source       TEXT,
  source_skill TEXT,
  event_at     TEXT,                           -- article publish time (nullable)
  relevance    INTEGER,
  status       TEXT NOT NULL DEFAULT 'new',    -- new | read | archived
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_status ON news_items(status, created_at);

CREATE TRIGGER IF NOT EXISTS trg_news_touch AFTER UPDATE ON news_items
BEGIN UPDATE news_items SET updated_at = datetime('now') WHERE id = NEW.id; END;
```

- Register `news_items` in `ea/db.py _STATUS_TABLES` (enables `update_status`) and `mcp_server/tools.py _READABLE` (enables MCP `list_rows`).
- `learning` table unchanged (already in both sets; already has a touch trigger).

## db helpers (`ea/db.py`)

```python
# reads (mirror list_signals: newest first, optional status/topic filter)
list_learning(conn, status=None, topic_id=None) -> list[Row]   # ORDER BY event_at DESC NULLS-last, id DESC
list_news(conn, status=None, topic_id=None)     -> list[Row]   # ORDER BY event_at DESC, id DESC

# writes (mirror add_trend_finding: dedup on external_ref, ON CONFLICT DO NOTHING, return rowcount)
add_learning(conn, **fields)  -> int   # _LEARNING_COLS whitelist; requires external_ref
add_news_item(conn, **fields) -> int   # _NEWS_COLS whitelist; requires external_ref
```

Column whitelists (SQL-injection guard, same pattern as `_DEADLINE_COLS`):
```python
_LEARNING_COLS = {"kind","source","source_skill","title","synopsis","url","external_ref",
                  "provider","event_at","topic_id","relevance","status"}
_NEWS_COLS     = {"title","url","synopsis","external_ref","topic_id","source",
                  "source_skill","event_at","relevance","status"}
```
`add_*` raise `ValueError` on unknown columns or missing `external_ref`.

Ordering note: SQLite sorts NULLs first on `DESC`; to keep dated items above undated, order by `event_at IS NULL, event_at DESC, id DESC`.

## Feed aggregation (`lib/feed.py`)

```python
CATEGORIES = ("trending", "news", "learning", "topics")

def overview(conn) -> dict:
    """{'counts': {cat: int}, 'recent': [item, ...]} — recent = newest N (default 12)
    across news + learning + trend_findings, each enriched with SP1 tags + links."""

def filter_ids(conn, ref_type, tag=None, origin=None, person=None) -> set[int] | None:
    """Return the set of ref_ids matching the given tag/origin/person filters for
    ref_type, or None when no filter is supplied (caller keeps all rows).
    - tag/origin: resolve tag name -> id, then db.content_ids_by_tag(tag_id, ref_type).
      origin is just a tag whose name is 'internal' or 'external'.
    - person: content_links WHERE ref_type=? AND target_type='person' AND target_id=?.
    Multiple filters intersect. Unknown tag/origin name -> empty set (no matches)."""
```

`overview` counts: `trending` = count of `trends` in the current window (reuse `list_trends` with the configured window, or a COUNT); `news`/`learning` = count of rows with status != 'archived'/'dismissed'; `topics` = active topics count. Recent items carry `{category, id, title, when, url, status, tags, links}` where `when` = `event_at` or `created_at`.

Enrichment reuses SP1 `db.list_tags_for(ref_type, id)` + `db.list_links_for(ref_type, id)` per item (N+1, acceptable single-user).

## Endpoints (`web/app.py`)

```
GET  /api/feed
     -> {"counts": {...}, "recent": [ {category,id,title,when,url,status,tags,links}, ... ]}

GET  /api/news?status=&topic=&tag=&person=&origin=
GET  /api/learning?status=&topic=&tag=&person=&origin=
     -> list of rows, each enriched with tags[] + links[]; filters intersect.
        status/topic use native columns; tag/person/origin use filter_ids().

POST /api/news/{id}/status      {status}   -> reuse db.update_status(conn,'news_items',id,status)
POST /api/learning/{id}/status  {status}   -> reuse db.update_status(conn,'learning',id,status)

GET  /api/trends?window_start=&tag=&origin=
     -> existing trends list, additionally filtered by tag/origin via filter_ids('trend').
        (topic/person filtering lives on findings, deferred — see Out of scope.)
```

Ref_type mapping for enrichment/filtering: news → `'news'`, learning → `'learning'`, trends → `'trend'`, trend_findings → `'trend_finding'` (all already in SP1 `_TAGGABLE_TYPES`). Bad `status` on the POST endpoints surfaces the existing `update_status` behavior (returns 0 → 404 "not found"); unknown filter values yield an empty result, not an error.

## MCP tools (`mcp_server/tools.py` + `server.py`)

```python
add_learning(kind, title, external_ref, source='skill', synopsis=None, url=None,
             provider=None, event_at=None, topic_id=None, relevance=None,
             status='suggested', source_skill=None) -> int
add_news(title, external_ref, url=None, synopsis=None, topic_id=None,
         source='web', source_skill=None, event_at=None, relevance=None,
         status='new') -> int
```

Thin wrappers over `db.add_learning`/`db.add_news_item` following the `add_trend_finding` idiom (build a fields dict, drop None optionals, delegate). `news_items` also becomes readable via the existing generic `list_rows` MCP tool (added to `_READABLE`).

## Skill populator

New `skills/news_search/SKILL.md` (mirrors `trending_search`): for each active topic, search current headlines, extract `title`/`url`/`synopsis`/`event_at`/`relevance`, call `add_news` (dedup on url as `external_ref`), then per the SP1 convention `link_content('news', id, 'topic', topic_id)` and any matched people, and `tag_content('news', id, 'external')`. Respect `topics.max_suggest` per topic per run; log a `skill_run`.

Learning stays populated by the existing `compile_learning_email` / `extract_research_training_email` skills, now using the new `add_learning` MCP tool (their SP1 "Associate what you create" block already tells them to link topic/people + tag).

## Frontend api.ts (types + fetchers only; components are SP3)

```ts
export interface NewsItem { id:number; title:string; url?:string; synopsis?:string;
  topic_id?:number; source?:string; event_at?:string; relevance?:number; status:string;
  tags?: ContentTag[]; links?: ContentLink[] }
export interface LearningItem { id:number; kind:string; title:string; synopsis?:string;
  url?:string; provider?:string; event_at?:string; topic_id?:number; relevance?:number;
  status:string; tags?: ContentTag[]; links?: ContentLink[] }
export interface FeedRecent { category:string; id:number; title:string; when:string;
  url?:string; status:string; tags?: ContentTag[]; links?: ContentLink[] }
export interface FeedOverview { counts: Record<string,number>; recent: FeedRecent[] }

// filters is a plain object serialized to query string (status/topic/tag/person/origin)
getFeed(): Promise<FeedOverview>
getNews(filters?): Promise<NewsItem[]>
getLearning(filters?): Promise<LearningItem[]>
setNewsStatus(id, status) / setLearningStatus(id, status)
```

Reuse existing `fetchJson`/`postJson`. `ContentTag`/`ContentLink` already exist from SP1.

## Seed data (`ea/seed.sql`)

Add ~2 `learning` rows and ~2 `news_items` rows (varied topic_id, status, event_at) plus a couple of `content_tags`/`content_links` associations and an `internal`/`external` origin tag, so SP3 renders real content in dev without waiting on a skill run.

## Testing

- **db:** `list_learning`/`list_news` ordering + status/topic filter; `add_learning`/`add_news_item` dedup on external_ref + reject unknown column + require external_ref.
- **lib/feed:** `overview` counts + recent shape/ordering + tag/link enrichment present; `filter_ids` by tag, by origin, by person, intersection of two filters, unknown name → empty set, no-filter → None.
- **web:** `/api/feed` shape; `/api/news` + `/api/learning` list + each filter param + intersection; status POST happy path + 404 on missing id; `/api/trends` origin/tag filter narrows results.
- **MCP:** `add_learning`/`add_news` tools write and are listable via `list_rows`.
- **seed:** existing seed test still green with the added rows.

## Out of scope (SP3 / later)

- Reactive Data Feed page, newsroom UI, left-nav/right-detail, redirects from /trending & /topics → SP3.
- Trends filtering by topic/person (findings-level join) — add if SP3 needs it.
- Manual Learning/News add/edit/delete — read + status only for now (YAGNI).

## Global Constraints

- SQLite (stdlib `sqlite3`) only; migration idempotent via `CREATE … IF NOT EXISTS`.
- All `add_*` column names validated against Python whitelists before SQL (injection guard); `ref_type` values passed to SP1 helpers are literal constants, never request strings interpolated into SQL.
- Origin stored ONLY as an SP1 tag (`internal`/`external`), never a column.
- `/api/feed` overview default recent count = 12.
- Reuse SP1 `db.list_tags_for`/`list_links_for`/`content_ids_by_tag` for all enrichment/filtering — do not add a parallel association path.
- Backend `python -m pytest -q` green (run via `cd backend && ../.venv/bin/pytest`); frontend `tsc -b` green for the api.ts additions.
- Semantic commits; branch → verify → merge (no-ff); rebuild container + confirm served on :8765.
