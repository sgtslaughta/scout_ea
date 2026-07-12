# F3 — Fold Inbox + Actions into Data Feed — Design

**Date:** 2026-07-12
**Status:** Approved (design), pending spec review → plan
**Type:** Single feature, 5 implementation tasks (frontend only)
**Scope:** Frontend only. No backend/API changes.

## Problem

Post-consolidation, signals (Inbox) and outgoing actions (Actions) live in a `Review` view (tabs [Inbox | Actions]). The user wants them folded into **Data Feed** as first-class sections, with the Inbox's four status **tabs replaced by filter tags/chips** in one unified list. Data Feed is the natural home — signals and actions are additional content streams alongside news/trending/topics.

## Goal

- Inbox + Actions become **FeedRail sections** in Data Feed.
- Inbox status tabs → **filter chips** over one unified signal list.
- **Review dissolves**; nav drops from 8 → 7.
- All deep links (`/inbox`, `/actions`, `/review`, widget drill-downs) keep working via redirects/param-preselect.

## Decisions (locked)

- **Two sections** (not one merged stream): `inbox` (signals) + `actions` (actions) — matches the two distinct data models + mutation sets.
- **Reuse existing list UI:** Inbox keeps its MUI DataGrid + row actions; Actions keeps its grouped card rendering (already tab-free).
- **Signal row click → the F1 `ResponseDetailModal`** (5 W's + reasoning + actions) — one consistent detail surface app-wide.
- Frontend only; no backend change.

## Architecture

### Feed shell additions

- `components/feed/types.ts`: `FeedView` gains `'inbox' | 'actions'`.
- `components/feed/FeedRail.tsx`: `ITEMS` gains `{ id: 'inbox', label: 'Inbox', Icon: Mail }` and `{ id: 'actions', label: 'Actions', Icon: CheckCircle }` (lucide-react).
- `views/DataFeed.tsx`: add both to `VIEWS`; render `{view === 'inbox' && <FeedInboxSection .../>}` and `{view === 'actions' && <FeedActionsSection/>}`. `?view=` initialization already exists.

### `FeedInboxSection` (new, `components/feed/FeedInboxSection.tsx`)

- Fetches all signals via `getSignals()` (no status arg → all statuses), `refetchInterval: 15000`.
- **Filter chips (tabs replacement):**
  - Status chips `new · triaged · actioned · dismissed` — single-select toggle (click active chip to clear → shows all). Mirrors the `FeedList` origin-chip pattern.
  - `Proactive` chip — independent toggle, filters `type === 'proactive'`.
  - Client-side filtering over the fetched list.
- **Preselect from URL:** reads `?status=` and `?type=proactive` from `useSearchParams` to set initial chip state (preserves widget/KpiStrip deep links).
- **DataGrid:** reuse Inbox's columns verbatim — priority dot, title (tooltip), source chip, created_at (relative), actions cell (`ActionBadge`, `ActionMenu`, Dismiss, Triage).
- **Row click → `ResponseDetailModal`** with `kind="signal"` and the full row Signal; `onStatus` maps to the dismiss/triage mutations.
- Mutations: `setSignalStatus('signals', id, 'dismissed' | 'triaged' | 'read')` via `useMutation`, invalidating `['signals']`.

### `FeedActionsSection` (new, `components/feed/FeedActionsSection.tsx`)

- Fetches `listActions()`, `refetchInterval: 10000`.
- Reuses Actions' three labeled groups (Pending = `drafted && review`, Running = `executing`, Recent = `completed | failed`) — labeled groups already read as identifiers, not tabs.
- Reuses approve/dismiss (`approveAction`/`dismissAction`) + the `preview()` and `safeHttpUrl` (from `lib/url`) helpers.

### Review removal + reference repoint

Delete `views/Review.tsx`, `views/Inbox.tsx`, `views/Actions.tsx` (their logic now lives in the feed sections). Repoint every reference:

| Site | Change |
|---|---|
| `nav.ts` | remove the `review` `NavItem` → NAV has 7 items |
| `App.tsx` | remove `/review` route + `ReviewView` import; redirects: `/inbox`→`/feed?view=inbox`, `/actions`→`/feed?view=actions`, `/review`→`/feed?view=inbox` |
| `components/CommandPalette.tsx` | `KIND_VIEW.signal`→`/feed?view=inbox`; rename quick action "Go to Review" → "Go to Inbox" (`/feed?view=inbox`) |
| `components/quickdraw/Quickdraw.tsx` | "Review in Actions" button → `navigate('/feed?view=actions')` |
| `components/actions/ActionBadge.tsx` | `navigate('/actions')` → `navigate('/feed?view=actions')` |
| `widgets/SignalsWidget.tsx` | `navigate('/inbox?status=new')` → `navigate('/feed?view=inbox&status=new')` |
| `widgets/registry.ts` | signals `drillDown: '/inbox?status=new'` → `'/feed?view=inbox&status=new'` |
| `widgets/KpiStrip.tsx` | tiles `to: '/inbox?...'` → `'/feed?view=inbox&...'` (proactive + signals tiles) |

Final nav (7): **Home · Tasks · Schedule · Data Feed · People · Automations · Settings.**

## Data flow

```
FeedRail (select 'inbox') → DataFeed renders FeedInboxSection
  → getSignals() (all) → chip filters (status single-select + proactive toggle) → DataGrid
  → row click → ResponseDetailModal(kind='signal', full row)
      → Silence/Dismiss → setSignalStatus → invalidate ['signals']
      → ActionMenu → createAction (existing infra)
  → ?status=/?type= in URL preselects chips

FeedRail (select 'actions') → FeedActionsSection
  → listActions() → 3 groups (pending/running/recent) → approve/dismiss
```

## Components / boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `FeedInboxSection` | Signals as a feed section: chip filters + DataGrid + modal | `getSignals`, `setSignalStatus`, `ResponseDetailModal`, `ActionBadge`/`ActionMenu` |
| `FeedActionsSection` | Actions as a feed section: grouped list + approve/dismiss | `listActions`, `approveAction`, `dismissAction`, `lib/url` |
| `FeedRail`/`types`/`DataFeed` (mod) | Register + route the two new views | existing feed shell |
| Review-removal edits | Drop Review, repoint refs, keep deep links | nav/routes/palette/widgets |

## Error / edge handling

- No signals / no actions → existing empty-state copy per section.
- Unknown `?status=` value → no chip preselected (shows all); never crash.
- Signal row with missing fields → `ResponseDetailModal` already dims/falls back (F1).
- Legacy routes always redirect; no route 404s that worked before.

## Testing

**New:**
- `FeedInboxSection`: renders signals; clicking a status chip filters the list; proactive toggle filters by type; `?status=triaged` preselects that chip; row click opens `ResponseDetailModal` (assert "AI Reasoning" appears).
- `FeedActionsSection`: renders the three groups; approve/dismiss call the mutations.

**Updated:**
- `App.routes.test.tsx`: `/inbox`→feed inbox, `/actions`→feed actions, `/review`→feed; Data Feed link present, no Review link.
- `views/containers.test.tsx`: drop Review case (file may be deleted if only Review remained).
- `Sidebar.test.tsx`: 7 items, no "Review".
- `CommandPalette.test.tsx`: signal nav → `/feed?view=inbox`; quick action label.

**Regression:** full FE suite + `npm run build` green.

## Success criteria

- Data Feed rail shows Inbox + Actions sections.
- Inbox status is chips, not tabs; one unified list; proactive toggle works.
- Signal row click opens the F1 modal.
- Nav shows 7 items; Review gone.
- Every legacy route + widget drill-down lands correctly (redirect or `?param` preselect).
- `views/Review.tsx`, `views/Inbox.tsx`, `views/Actions.tsx` deleted with no dangling imports.
- No backend diff.

## Non-goals

- Not merging signals + actions into a single stream (kept as two sections).
- Not rebuilding Inbox as feed-cards (DataGrid reused).
- Not changing signal/action data models or endpoints.
- Not multi-select status chips (single-select toggle); revisit only if requested.
- This supersedes consolidation **SP-3** (Review = Inbox+Actions); SP-3 is cancelled.
