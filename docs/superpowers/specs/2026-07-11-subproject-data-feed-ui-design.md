# SP3 — Data Feed Newsroom UI (Data Feed program)

**Status:** approved 2026-07-11
**Program:** Data Feed overhaul — SP3 of 3 (SP1 tagging DONE → SP2 backend DONE → **SP3 UI**).
**Goal:** A single reactive `/feed` "newsroom" page that consolidates Trending, News, Learning, and Topics into one viewport-filling dashboard: a category rail, a context-transforming main body, a slide-in detail pane, plus always-on instruments (context bar, headline wire, key-people carousel). Consumes the live SP2 `/api/feed`/`/api/news`/`/api/learning` + SP1 `TagChips`/`TagEditor`.

## Design principles

- **Viewport-filling app-shell.** The page fills the viewport and *never scrolls as a whole*; only individual panes scroll internally. On a normal desktop window everything fits with little vertical scroll and no meaningful truncation/overflow/overlap.
- **One state, many readers.** A single `{view, selected}` state drives the rail, body, context bar, and detail. No new state machine.
- **Three data lenses, no redundancy.** The Wire is headline-only/global; the recent stream is full-card/recent; the carousel is person-pivoted. Same SP2 feed, deliberately different densities.
- **Restrained motion.** Marquee (Wire) + horizontal scroll (carousel) + one-shot slide (detail) — never two auto-animations at once; all gated by `prefers-reduced-motion`.
- **Reuse over rebuild.** SP1 `TagChips`/`TagEditor`/`tagColors`, SP2 api fetchers, existing `MarqueeText`, and the existing Trending/Topics logic are re-housed, not rewritten.

## Layout & viewport-fill mechanics

```
╔═ /feed  (height: calc(100vh − 48px); flex column; overflow:hidden) ═╗
║ ① FeedContextBar        [view title]      · view-aware actions ▸    ║  ~44px fixed
╟────────────────────────────────────────────────────────────────────╢
║ ② NewsWire   ‹ headline · headline · headline · headline ›          ║  ~32px fixed
╟──────┬───────────────────────────────────────────┬─────────────────╢
║ ③rail│ ④ body (flex:1, min-width:0)               │ ⑤ FeedDetail    ║  flex:1, min-height:0
║ Over │  Overview: KPI tiles / carousel / stream   │  (absolute,     ║
║ Trend│  Category: filter chips + list             │   slide-in,     ║
║ News │                                            │   ~360px)       ║
║ Learn│                                            │                 ║
║ Topic│                                            │                 ║
╚══════┴───────────────────────────────────────────┴─────────────────╝
```

- Root: `Box` `height: calc(100vh - 48px)`, `display:flex; flexDirection:column; overflow:hidden`.
- Rows: ContextBar (fixed) + NewsWire (fixed) + main region (`flex:1, minHeight:0, display:flex`).
- Main region children: `FeedRail` (fixed width ~150px; collapsible to icon-only) + body (`flex:1, minWidth:0, position:relative`) + `FeedDetail` (`position:absolute; right:0; top:0; bottom:0; width:360px`; translateX off-screen when closed → opening never reflows the body).
- **Overview body** = CSS grid rows `auto auto 1fr`: KPI tiles (fixed) · Key-People carousel (fixed height, `overflow-x:auto`) · recent stream (`minHeight:0, overflow-y:auto`). Tuned to fit ~900px tall without page scroll.
- **Category body** = flex column: filter chips (fixed) + list (`flex:1, minHeight:0, overflow-y:auto`).
- Every flex child that holds scrollable content gets `min-height:0`/`min-width:0`; long text uses `MarqueeText` or ellipsis, never wrap-and-grow.

**Responsive ("reactive to a point"):** primary target = normal desktop (fits, minimal scroll). `@media` / container breakpoints: below ~1100px the detail becomes a full-width overlay and the rail auto-collapses to icons and the carousel shows fewer cards; below ~700px the shell degrades to single-column stacked (fallback, not the design target).

## Components (new files, each one responsibility)

| File | Responsibility |
|------|----------------|
| `views/DataFeed.tsx` | Shell. Owns `{view: 'overview'\|'trending'\|'news'\|'learning'\|'topics', selected: {category,id}\|null}`. Reads `?view=` once on mount (redirect landing) to seed `view`. Lays out the 5 zones; passes state + setters down. |
| `components/feed/FeedRail.tsx` | Category nav (5 entries + icons). Collapsible (icon-only) with localStorage `ea-feed-rail-collapsed`. Highlights active view. |
| `components/feed/FeedContextBar.tsx` | View-aware quick actions + "updated Nm ago". Overview→Refresh/Mark-all-read; News→origin filter + mark-read; Learning→status filter; Topics→Add topic; a selection→open person/topic. |
| `components/feed/NewsWire.tsx` | Marquee of latest news+trend headlines (from `getFeed().recent` filtered to news/trending). Reuses `MarqueeText`; pause-on-hover; reduced-motion → static scroll list. Click headline → open detail. |
| `components/feed/KeyPeopleCarousel.tsx` | Horizontal card row (drag/arrow scroll, no autoplay). One card per key person (people with `importance<=2`) showing their latest linked feed item + time + color chips. Click → detail or `/people`. Overview only. |
| `components/feed/FeedOverview.tsx` | KPI count tiles (`feed.counts`) + `KeyPeopleCarousel` + recent stream (`feed.recent` as `FeedItemCard`s). |
| `components/feed/FeedList.tsx` | Category filtered list. Filter chips (origin internal/external, status, tag) → query params to `getNews`/`getLearning`/`getTrends`. Rows = `FeedItemCard`. |
| `components/feed/FeedItemCard.tsx` | Shared item card: title, source, friendly time, `TagChips`, hover-detail Tooltip, click → select (opens detail) or external `url` nav. Used by stream/list/carousel. |
| `components/feed/FeedDetail.tsx` | Slide-in panel for `selected`: title/source/friendly-when/synopsis, `TagEditor` (add/remove tags + person/topic links; works for any category via `refType`), status actions **only for news/learning** (`setNewsStatus`/`setLearningStatus`) — trending items have no status, so that action row is hidden for them, close button. |

Topics category body re-houses the existing `Topics.tsx` management UI (add/edit/delete/activate — full CRUD inline). Trending category body re-houses the existing `Trending.tsx` bars/list. Both are moved into feed sub-components; their existing tests migrate.

## Data flow

- `getFeed()` (queryKey `['feed']`) → overview KPI counts + recent stream + Wire headlines + carousel source (recent items with person links).
- `getNews`/`getLearning`/`getTrends` (queryKeys `['news',filters]` etc.) → category lists; filter chips drive the `FeedFilters` object.
- Detail status actions → `setNewsStatus`/`setLearningStatus`, then invalidate `['feed']` + `['news']`/`['learning']`.
- Tag/link edits inside `FeedDetail` reuse SP1 `TagEditor` (invalidates `['content-refs', …]` + the row query).
- Polling: existing TanStack default (15s) — the ContextBar "updated Nm ago" reads `dataUpdatedAt`. Manual Refresh = `invalidateQueries`.

## Routing & fold-in

- Add lazy route `/feed` → `DataFeed`. Single route; category is internal state.
- `App.tsx`: `/trending` → `<Navigate to="/feed?view=trending" replace>`, `/topics` → `<Navigate to="/feed?view=topics" replace>`. `DataFeed` reads `?view=` on mount only (does not keep URL in sync — no per-view URL, no back-button churn).
- `Sidebar.tsx`: remove the `trending` and `topics` entries; add one `{ id:'feed', route:'/feed', icon: Newspaper, label:'Data Feed' }`. Command palette (`KIND_VIEW` map) points trending/topic/news/learning kinds at `/feed?view=…`.
- Old `views/Trending.tsx` / `views/Topics.tsx` files: their logic moves into `components/feed/` sub-views; the route-level view files are removed once the feed hosts them.

## Visual direction (frontend-design treatment at build)

Newsroom / control-room: dark-first (theme-aware via the 5-theme system), data-dense, hairline dividers, monospace `"JetBrains Mono"` timestamps, semantic color chips (origin internal/external + urgency via SP1 palette keys), tight type scale, generous use of `tabular-nums` for counts. KPI tiles read at a glance (number + label + tiny sparkline where a series exists). No flashy hero; the density *is* the aesthetic. Motion only where it serves (Wire, carousel, detail slide), all reduced-motion gated.

## Testing

- Each `components/feed/*` unit test: render + primary interaction (click-nav / select) + empty & loading states + theme-token classes present.
- `DataFeed` shell: initial `?view=` seeds the right view; rail click switches body; item click opens detail; close clears `selected`; page root carries `overflow:hidden` (no-page-scroll contract).
- Redirects: `/trending` renders feed with view=trending; `/topics` → view=topics.
- Sidebar: has Data Feed, lacks Trending/Topics entries.
- Migrated Trending/Topics tests still pass against their new home.
- `tsc -b` + `vitest run` + `npm run build` green.

## Out of scope / deferred

- Per-person threaded history (full timeline) — carousel shows latest-per-person + click-through to `/people`.
- Manual News/Learning create/edit (status only, per SP2) — add later if needed.
- Trends topic/person filtering at findings level — only tag/origin filter (SP2 scope).
- Saved views / custom feed filters persistence.

## Global Constraints

- React 19 + TypeScript + MUI v7 (**`sx` only, no system props**) + MUI X where a grid fits; TanStack Query; react-router v7.
- Page is viewport-filling: root `overflow:hidden`, panes scroll internally; no whole-page scroll on the design-target desktop size.
- Reuse SP1 `TagChips`/`TagEditor`/`tagColors` and SP2 api fetchers/types — no parallel data or association paths.
- Theme-aware (all 5 themes, light+dark) via existing tokens/palette keys; chips use SP1 palette keys.
- Single `/feed` route + internal state; `/trending`+`/topics` redirect via `?view=`; sidebar shows one Data Feed entry.
- `prefers-reduced-motion` respected on Wire, carousel, and detail transition.
- Frontend `tsc -b`, `vitest run`, `npm run build` green before each commit; verify served bundle == built on `:8765`.
- Semantic commits; branch → verify → merge (no-ff).
