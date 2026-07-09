# MUI Migration + Widget Dashboard — Design

**Date:** 2026-07-08
**Status:** Approved
**Scope:** Full frontend migration to Material UI + MUI X (Community/MIT), rebuilt interactive dashboard, 3 phases.

## Goals

- Dashboard: information-dense, interactive, every datapoint rich (hover quick-peeks, drill-down links, live counts, sparklines).
- Extensible: adding a new data source = one widget file + one registry entry.
- Modern components: MUI X DataGrid, Charts, TreeView across the app.
- Preserve: dark/light + OS detection, accent personalization, TanStack Query data layer, ⌘K palette, vitest suite, Playwright screenshot verification.

## Decisions (user-confirmed)

| Decision | Choice |
|---|---|
| MUI scope | Full app migration |
| MUI X tier | Community / MIT (no Pro features: no grid tree-data, row grouping, aggregation, pinned columns) |
| Extensibility | Widget registry + user-editable layout |
| Drill-down | Existing views pre-filtered via URL query params |
| Sequencing | 3 phases, dashboard first; each phase own plan → merge |
| Reorder UX | Widget menu (show/hide/reorder); no drag-and-drop dep |

## Phase 1 — Foundation

**Deps added:** `@mui/material @emotion/react @emotion/styled react-router-dom`

- **Theme bridge:** MUI v7 theme with `cssVariables: true` and `colorSchemes: { light, dark }`. Existing tokens (bg, surface, surface-2, border, text, muted, accent, ok, warn, crit, info) map to MUI palette; accent = `palette.primary`, still set from localStorage (`ea-accent`). `lib/theme.ts` adapts to drive MUI `colorScheme` incl. OS detection (`mode: 'system'`).
- **Routing:** react-router. Routes: `/` (dashboard), `/inbox`, `/tasks`, `/calendar`, `/deadlines`, `/trending`, `/docs`, `/people`, `/topics`, `/settings`. Filters via query params (e.g. `/deadlines?due=24h`, `/inbox?priority=1`). Lazy route chunks (as today).
- **Shell:** Sidebar, SignatureBar, RightDrawer rebuilt in MUI (Drawer, AppBar, IconButton). Sidebar items = NavLink. CommandPalette (cmdk) stays; navigation via `navigate()`. TodayBriefing modal → MUI Dialog.

## Phase 2 — Widget-Registry Dashboard

**Deps added:** `@mui/x-data-grid @mui/x-charts` (`@mui/x-tree-view` in Phase 3)

### Registry

```ts
interface WidgetDef {
  key: string                        // 'deadlines'
  title: string
  size: 'sm' | 'md' | 'lg'           // CSS grid span
  component: React.LazyExoticComponent<React.ComponentType>
  drillDown: string                  // route target, e.g. '/deadlines'
}
```

- `frontend/src/widgets/registry.ts` exports `WIDGETS: WidgetDef[]`.
- Layout = ordered array of widget keys + hidden set, persisted to localStorage key `ea-dashboard-layout`. (DB persistence later if multi-device needed.)
- Edit mode: per-widget menu → hide, move up/down; "Add widget" lists hidden ones. Reset-to-default action.
- **Contract: new data source = one widget component file + one registry entry.**

### WidgetCard chrome (shared)

Title, live count chip, hover-revealed toolbar: refresh (invalidate query), expand (full-size MUI Dialog), open view (drill-down route), hide. Per-widget React error boundary rendering MUI Alert — one failing source never blanks the dashboard. Loading = MUI Skeleton.

### Widgets (initial set)

1. **KPI strip** — 6 stat tiles (Proactive, Due Today, Urgent <24h, Rising, Signals, Skill Runs) each with MUI X SparkLineChart mini-trend; click → pre-filtered view.
2. **Deadlines** — compact DataGrid, countdown column color-coded (overdue=crit, <24h=warn); click row → `/deadlines?id=`.
3. **Trending** — MUI X BarChart of top movers + list with delta chips; click → `/trending?dir=rising`.
4. **Signals** — compact DataGrid with priority indicator; click → `/inbox`.
5. **Skill activity** — MUI X BarChart items-created per skill + status; no dedicated view exists, so drill-down = expand dialog with full run history table.
6. **Today** — next calendar events + tasks due today; click → `/calendar`, `/tasks`.

### Interactions

- Row/point hover → MUI Popover quick-peek: full details + inline actions (e.g. complete task, ack signal).
- Any click lands on an existing view pre-filtered via query params.
- Data layer unchanged: TanStack Query hooks over `api.ts`, 15s refetch.

## Phase 3 — View Migration

- **DataGrid:** Inbox, Tasks, Deadlines, Trending, People, Topics (sort/filter/density built-in; column defs per view).
- **TreeView:** Topics/Docs hierarchical browsing where data is nested.
- **MUI forms:** Settings.
- **Calendar:** custom month grid restyled with MUI primitives.
- Every migrated view reads its query params for pre-filtering (drill-down contract).
- **Cleanup:** remove tailwindcss, recharts, framer-motion, tailwindcss-animate, cva once unused; delete Tailwind config/App.css remnants. Bundle size checked before/after.

## Error handling

- Widget-level error boundaries (Phase 2).
- API errors: existing TanStack Query retry/stale behavior; widgets show Alert with retry button.
- Unknown widget key in stored layout → skipped silently (registry is source of truth).

## Testing

- Vitest stays. New: registry renders all defs, layout persistence round-trip, query-param filter parsing per view.
- Existing view tests migrate alongside each view.
- Playwright screenshots (dark+light, seeded data) for visual verification, per established flow (venv backend on :8765, seed_demo → repo-root ea.sqlite).
- CI (`.github/workflows/ci.yml`) must stay green each phase.

## Out of scope

- MUI X Pro features, drag-and-drop reorder, user-composed widgets from arbitrary endpoints, DB-persisted layouts, backend changes.
