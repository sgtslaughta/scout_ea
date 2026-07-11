# SP1 — Universal Tags & Links (Data Feed program, foundation)

**Status:** approved 2026-07-11
**Program:** Data Feed overhaul — SP1 of 3 (SP1 tagging → SP2 Data Feed backend → SP3 newsroom UI).
**Goal:** A single app-wide association layer: colored label **tags** and typed **entity links** (content→person/topic), usable from the web UI, the MCP server, and skills. Fold the existing deadline-scoped tags/links into it so there is exactly one system.

## Why

Deadlines already have `deadline_tags` (freeform labels) + `deadline_links` (typed refs to person/task/event). The Data Feed program needs the same association power across all content (trends, news, learning, signals, …) — including associating feed items with topics and "key people". Rather than clone the deadline pattern per table, generalize it once. SP2/SP3 consume this to filter and cross-reference the feed.

## Architecture

Three tables, whitelisted polymorphic refs, thin helpers reused by web + MCP + skills.

- **`tags`** — the label vocabulary (name + theme-palette color key).
- **`content_tags`** — many-to-many: which tags are on which content row.
- **`content_links`** — directed association from a content row to a target entity (person/topic).

`ref_type`/`target_type` are validated against Python whitelists before any SQL interpolation (same injection-guard pattern as `_DEADLINE_COLS`/`_REF_LABEL_SQL`). Colors are stored as palette **keys**, not hex, so chips resolve to the active theme's tokens in the frontend and stay on-theme across all five themes.

## Data model — `features.sql` migration 006

```sql
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT 'neutral',   -- palette key, not hex
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  ref_type   TEXT NOT NULL,   -- deadline|task|signal|event|trend|trend_finding|learning|news|person|topic
  ref_id     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tag_id, ref_type, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_content_tags_ref ON content_tags(ref_type, ref_id);

CREATE TABLE IF NOT EXISTS content_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_type    TEXT NOT NULL, ref_id    INTEGER NOT NULL,   -- the content
  target_type TEXT NOT NULL, target_id INTEGER NOT NULL,   -- person|topic
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ref_type, ref_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_content_links_ref ON content_links(ref_type, ref_id);
```

### Whitelists (in `ea/db.py`)

```python
_TAGGABLE_TYPES = {"deadline","task","signal","event","trend","trend_finding",
                   "learning","news","person","topic"}
# target_type -> label-lookup SQL (extends the existing _REF_LABEL_SQL idea)
_LINK_TARGET_SQL = {
    "person": "SELECT name  AS label FROM people WHERE id=?",
    "topic":  "SELECT name  AS label FROM topics WHERE id=?",
}
```

### Color palette keys

`neutral | red | amber | green | teal | blue | violet | pink` (8). Frontend `lib/tagColors.ts` maps each key to a CSS var pair `{bg, fg}` derived from theme chart/semantic tokens (`--chart-1..5`, semantic red/amber/green). Unknown/legacy key → `neutral`.

## Deadline migration (idempotent, in `db._migrate`)

Guard: run only when `deadline_tags` table exists AND `content_tags` has zero `ref_type='deadline'` rows (prevents double-apply).

1. For each distinct `deadline_tags.tag`: `get_or_create_tag(name, 'neutral')`.
2. Insert `content_tags(tag_id, 'deadline', deadline_id)` for each old row.
3. For each `deadline_links(deadline_id, ref_type→target_type, ref_id→target_id)`: insert `content_links('deadline', deadline_id, target_type, target_id)`. Old deadline links used `ref_type ∈ {person,task,event}`; `task`/`event` are not in `_LINK_TARGET_SQL`, so they migrate as links with `label` falling back to `"{target_type} #{id}"` (acceptable — deadlines mostly link people; unresolved types still display).
4. `DROP TABLE deadline_tags; DROP TABLE deadline_links;`

Also **remove the `deadline_tags`/`deadline_links` `CREATE TABLE … IF NOT EXISTS` from `features.sql`** in the same task — otherwise `init_db` (which runs `features.sql` *before* `_migrate`) would recreate the empty tables every boot right before the guard skips them. After removal: fresh DBs never create them; existing DBs get the one-time data move then the drop, and nothing recreates them.

`add_deadline_link`/`add_deadline_tag` and their endpoints are removed; `Deadlines.tsx` retargets to the universal endpoints (ref_type `'deadline'`).

> Migration is one-way and additive-then-drop within a single `_migrate` transaction. `_migrate` already runs on every `init_db`; the guard makes re-runs no-ops.

## db.py helpers

```python
get_or_create_tag(conn, name, color='neutral') -> int          # dedupe on name; returns tag id
tag_content(conn, ref_type, ref_id, name, color='neutral') -> int   # get_or_create + attach; idempotent
untag_content(conn, ref_type, ref_id, tag_id) -> int
list_tags_for(conn, ref_type, ref_id) -> list[dict]            # [{tag_id,name,color}]
link_content(conn, ref_type, ref_id, target_type, target_id) -> int    # idempotent
unlink_content(conn, link_id) -> int
list_links_for(conn, ref_type, ref_id) -> list[dict]           # [{id,target_type,target_id,label}]
list_all_tags(conn) -> list[Row]                               # [{id,name,color}] for pickers
content_ids_by_tag(conn, tag_id, ref_type=None) -> list[dict]  # [{ref_type,ref_id}] — SP2/3 filtering
```

All validate `ref_type ∈ _TAGGABLE_TYPES` (and `target_type ∈ _LINK_TARGET_SQL`) and raise `ValueError` otherwise. Inserts use `ON CONFLICT … DO NOTHING` for idempotency and return rowcount.

## Endpoints (`web/app.py`)

```
GET    /api/tags                                   -> [{id,name,color}]
POST   /api/tags                {name,color}       -> {id}          # explicit create/recolor
POST   /api/content/{ref_type}/{ref_id}/tags  {name, color?}  -> {ok:true}   # get-or-create + attach
DELETE /api/content/{ref_type}/{ref_id}/tags/{tag_id}         -> {deleted:n}
POST   /api/content/{ref_type}/{ref_id}/links {target_type,target_id} -> {ok:true}
DELETE /api/content/{ref_type}/{ref_id}/links/{link_id}       -> {deleted:n}
GET    /api/content/{ref_type}/{ref_id}/refs      -> {tags:[…], links:[…]}   # combined read
```

Bad `ref_type`/`target_type` → 400. Unknown id on DELETE → 404. Pydantic bodies: `TagCreate{name,color='neutral'}`, `ContentTagBody{name,color='neutral'}`, `ContentLinkBody{target_type,target_id}`.

## MCP tools (`mcp_server/tools.py` + `server.py`)

```python
tag_content(ref_type, ref_id, tag, color='neutral') -> int   # wraps db.tag_content
link_content(ref_type, ref_id, target_type, target_id) -> int# wraps db.link_content
list_tags() -> list[dict]                                    # wraps db.list_all_tags
```

Whitelist validation happens in `ea.db`, so the MCP surface inherits the guard. Errors surface as tool exceptions.

## Skill awareness

Skills are markdown prompts that instruct the agent which MCP tools to call. Add a **Tagging convention** section to `skills/README.md` and a short reminder block to each content-producing skill prompt:

- `trending_search`, `compute_trends` — after `add_trend_finding`/`upsert_trend`, `link_content` the item to matched topics/people and `tag_content` with the trend term + `origin` label (`internal`/`external`).
- `research_topics` — `link_content` findings to their topic; tag by subject.
- `compile_learning_email`, `extract_research_training_email` — `link_content` learning items to topic/provider people; tag by `kind`.
- `triage_email`, `triage_teams` — tag signals with detected topics/people links.

Convention text (canonical, copied into README): *"Every content row you create should be associated: call `link_content` to connect it to the relevant person(s)/topic(s), and `tag_content` with 1–3 short lowercase labels. Reuse existing tag names (`list_tags` first) before inventing new ones."*

## Frontend (reusable primitives — consumed by SP3)

- `lib/tagColors.ts` — `TAG_COLORS: Record<ColorKey,{bg,fg}>` using theme CSS vars; `colorOf(key)` with neutral fallback.
- `components/TagChips.tsx` — renders tag + link chips (color from key; links show target label with a small type glyph). Optional `onTagClick`/`onLinkClick` for SP3 filtering/nav; display-only when omitted.
- `components/TagEditor.tsx` — generic `{refType, refId}` editor: tag autocomplete (from `GET /api/tags`, create-on-enter with color picker) + link picker (target type person/topic → entity select). Self-contained mutations invalidating the relevant queries. Generalizes today's `DeadlineRefsEditor`.
- `hooks`/`api.ts` — `Tag`, `ContentLink` types; `getTags`, `createTag`, `tagContent`, `untagContent`, `linkContent`, `unlinkContent`, `getContentRefs`.
- Retarget `Deadlines.tsx`: replace `DeadlineRefsEditor` usage + Refs column with `<TagEditor refType="deadline" refId={id}/>` and `<TagChips>`; drop deadline-specific fetchers.

## Testing

- **db:** `get_or_create_tag` dedupes on name; `tag_content` idempotent + rejects bad ref_type; `link_content` idempotent + resolves person/topic label + unknown target falls back; `content_ids_by_tag` filters; **migration**: seed a DB with `deadline_tags`/`deadline_links`, run `_migrate`, assert rows land in `content_tags`/`content_links`, old tables gone, re-run is a no-op.
- **web:** each endpoint happy path + 400 on bad ref_type + 404 on missing delete; `GET …/refs` combined shape.
- **MCP:** `tag_content` tool writes and `list_tags` reads back.
- **frontend:** `TagChips` renders colors + labels; `TagEditor` add/remove tag calls the mutation; `Deadlines` still renders refs via the universal path (existing tests updated, not deleted).

## Out of scope (later sub-projects)

- `/api/feed` aggregation, Learning CRUD, news source, internal/external `origin` surfacing → **SP2**.
- Reactive Data Feed page, newsroom design, tag-driven filtering UI → **SP3**.
- Additional `target_type`s beyond person/topic (task/event/deadline as link targets) — the schema already allows them; add label SQL when a consumer needs it.

## Global Constraints

- SQLite (stdlib `sqlite3`) only; migrations idempotent via `CREATE … IF NOT EXISTS` + guarded `_migrate`; `ALTER TABLE` has no `IF NOT EXISTS` (PRAGMA-guard any needed).
- All polymorphic `ref_type`/`target_type` values validated against Python whitelists before SQL — no user/agent string reaches an interpolated identifier.
- MUI v7: `sx` only, no system props. New chips theme-aware (light+dark, all 5 themes) via palette keys → CSS vars.
- Color stored as palette **key**, never resolved hex.
- Backend `python -m pytest -q` green; frontend `tsc -b` + `vitest run` + `npm run build` green before commit (CI runs all three).
- Semantic commits; branch → verify → merge (no-ff); rebuild container + confirm served bundle carries the change.
