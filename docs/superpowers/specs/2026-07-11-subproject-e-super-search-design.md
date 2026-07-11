# Sub-Project E — Super Search Design

Part of the [dashboard overhaul program](2026-07-11-dashboard-overhaul-design.md). Adds full-text search across all core entities, surfaced in the ⌘K palette.

## Goal

Type in the ⌘K palette and get live, section-grouped results from every core entity (tasks, signals, deadlines, events, people, topics, trends), each clicking through to its view. Backed by SQLite FTS5.

## Decisions

- **Index sync:** one standalone FTS5 table, rebuilt on each `/api/search` call. `data_version` is connection-local and doesn't bump for same-connection writes, so it's unusable as a staleness signal; the DB is single-user and small, so an unconditional rebuild (O(rows) INSERT) is correct and cheap. Frontend debounces (250ms) so rebuilds happen per query, not per keystroke. *Deferred:* a dirty-flag to skip rebuilds when unchanged — add if row counts grow large.
- **UI:** extend the existing ⌘K `CommandPalette` — below Navigation/Quick Actions, render a live "results" section grouped by entity kind. A magnifier icon + tooltip is added to the top bar (`SignatureBar`).

## Backend

### FTS5 index (`backend/ea/features.sql`)

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(kind, ref_id UNINDEXED, title, body);
```

(Idempotent, appended to the existing migration file loaded via `executescript` at init.)

### Search module (`backend/lib/search.py`)

- `SOURCES`: `(kind, insert_sql)` per entity — each `INSERT INTO search_index(kind, ref_id, title, body) SELECT '<kind>', id, <title>, <body> FROM <table> [WHERE active=1]`:
  - `signal` — signals: title, `coalesce(summary,'')||' '||coalesce(who,'')||' '||coalesce(what,'')||' '||coalesce(why,'')`
  - `task` — tasks: title, `coalesce(detail,'')`
  - `deadline` — critical_deadlines: title, `coalesce(detail,'')`
  - `event` — events: title, `coalesce(body,'')`
  - `person` — people (active=1): name, `coalesce(role,'')||' '||coalesce(org,'')||' '||coalesce(notes,'')`
  - `topic` — topics (active=1): name, `coalesce(description,'')`
  - `trend` — trends: term, `''`
- `rebuild(conn)`: `DELETE FROM search_index;` then run each source INSERT.
- `_fts_query(q)`: keep alphanumeric tokens only, append `*` (prefix) to each, join with space. Returns `None` for empty/garbage input — the sanitizer is the injection guard (no raw user text reaches the MATCH grammar).
- `search(conn, q, limit=30) -> list[dict]`: `fq = _fts_query(q)`; if `None` return `[]`; `rebuild(conn)`; then
  `SELECT kind, ref_id, title, snippet(search_index, 3, '[', ']', '…', 8) AS snippet FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT ?`.
  Returns `[{kind, ref_id, title, snippet}]`.

### Endpoint (`backend/web/app.py`)

```python
@app.get("/api/search")
def search_endpoint(q: str = "", conn=Depends(get_db)):
    return _search.search(conn, q)
```

## Frontend

### `api.ts`

```ts
export interface SearchResult { kind: string; ref_id: number; title: string; snippet: string }
export const search = (q: string) => fetchJson<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`)
```

### `CommandPalette.tsx`

- Set `shouldFilter={false}` on `<Command>` and filter Navigation/Quick-Action items ourselves by the typed text (simple `label` includes) — so server results (already ranked) always show.
- Debounce the input to `debouncedQ` (250ms). `useQuery(['search', debouncedQ], () => search(debouncedQ), { enabled: debouncedQ.length >= 2 })`.
- Render results grouped by kind into `Command.Group` sections (Tasks, Signals, Deadlines, Events, People, Topics, Trends). Item value `${kind}-${ref_id}` (unique). `onSelect` → `onViewChange(KIND_VIEW[kind])` (reuses existing prop; e.g. `signal→'inbox'`, `task→'tasks'`, `deadline→'deadlines'`, `event→'calendar'`, `person→'people'`, `topic→'topics'`, `trend→'trending'`), then close + clear.
- Each result shows title + muted snippet.

### `SignatureBar.tsx`

- Replace the bare `⌘K` text button with a `Search` (lucide) icon button, `Tooltip` "Search (⌘K)", same `onCommandOpen` handler. Keep the ⌘K keyboard shortcut (App-level, unchanged).

## Testing

- **backend `test_search.py`**: seed rows across 3+ tables; `search(conn, 'term')` finds the right rows with correct `kind`; prefix match (`bud` finds `budget`); empty/garbage `q` → `[]`; a FTS special char (e.g. `"`) doesn't raise; rebuild reflects a newly-inserted row.
- **frontend `CommandPalette.test.tsx`**: typing ≥2 chars calls `search` (mocked) and renders a result; clicking a result calls `onViewChange` with the mapped view; nav items still filter.

## Global Constraints

- FTS5 `MATCH` input MUST come only from the `_fts_query` sanitizer — never raw user text (injection/grammar-error guard).
- MUI v7 `sx` only; keep cmdk structure.
- Reuse `onViewChange` for result navigation — no new nav plumbing.
- `npx tsc -b` + `pytest` mandatory.
