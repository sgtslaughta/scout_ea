# Quickdraw — Action Panel (right drawer redesign)

**Status:** approved 2026-07-11
**Follows:** post-SP3 backlog. First of the three remaining backlog sub-projects (Quickdraw → Notifications → Timeline attention-grabber).
**Goal:** Rebuild the read-only right drawer (`RightDrawer.tsx`) into **Quickdraw** — a desktop-only *action panel* that surfaces what needs a fast response, ranked by urgency, with inline quick-actions, collapsible sections, a horizontally-expandable "morph" that reveals detail, a recent-activity feed, and a restrained western/gunslinger identity. Frontend-only: rides existing endpoints; no new backend this round.

## Design principles

- **Action over display.** Every row that *can* be acted on carries an action. The panel answers "what needs me, and let me deal with it here."
- **Reuse the plumbing.** Status changes ride the existing generic `POST /api/{table}/{row_id}/status`; "take action" reuses the `?focus=id` deep-links; type/urgency reuse `TimelineTypeChip` + existing urgency logic. No parallel data paths, no new backend.
- **Restrained personality.** The gunslinger nod is a name, one glyph, and a few empty-state lines — never sound, animation gimmicks, or anything that fights the 5-theme system.
- **Focused files.** The current 135-line drawer becomes a thin shell plus small single-responsibility children; nothing over ~200 lines.
- **Progressive disclosure.** Collapsed = compact triage; expanded = detail + inline actions. Both states persist.

## Layout & mechanics

```
╔═ Quickdraw (desktop lg+, borderLeft, flex column, overflow hidden) ═╗
║ ◎ QUICKDRAW                                   [expand ⇤/⇥ toggle]    ║  masthead (fixed)
╟────────────────────────────────────────────────────────────────────╢
║ ▸ NEEDS RESPONSE  (n)                                               ║  collapsible section
║     ⬤ glyph  title …………………  countdown   [Reply][Silence][⋯]        ║
║ ▸ APPROACHING  (n)                                                 ║  collapsible section
║     [D] title …………………………  due in 2h   [Take action][⋯]           ║
║ ▸ RECENT ACTIVITY  (n)                                             ║  collapsible (read-only)
║     ✓ skill-name · 4m ago                                          ║
╚════════════════════════════════════════════════════════════════════╝
   collapsed ≈300px  ⟷  expanded ≈560px (detail + inline action buttons)
```

- Root `Box`: `borderLeft`, `display:flex; flexDirection:column; overflow:hidden`, width from prefs (300 or 560). Rendered only at `lg+` (unchanged from today's `display:{ xs:'none', lg:'flex' }`).
- Masthead (fixed) holds the title+glyph and the expand toggle. Sections live in a `flex:1; overflowY:auto` stack.
- **Expand** is a width swap on the drawer container; because the drawer is the last flex child and the body has `min-width:0`, widening it shrinks the body without reflow/overlap. Width persisted.
- **Collapsed vs expanded row density:** collapsed rows show glyph + title (ellipsis/marquee) + countdown, actions behind a `⋯` menu. Expanded rows add the detail line(s) (signal who/what/why, alert body, full timestamp) and surface the primary action buttons inline.
- `prefers-reduced-motion`: expand/collapse is an instant width change (or respects the token); no bounce.

## Components (new files under `src/components/quickdraw/`)

| File | Responsibility |
|------|----------------|
| `Quickdraw.tsx` | Shell. Masthead (title + `Crosshair` glyph + expand toggle), width from `useQuickdrawPrefs`, renders the 3 sections. Replaces `RightDrawer` at the `App.tsx` mount site. |
| `QuickdrawSection.tsx` | Collapsible section: header (label, count chip, chevron), collapse state via `useQuickdrawPrefs`; renders children or a gunslinger empty-state line. Loading + error states. |
| `QuickdrawItem.tsx` | One row. Props: `{ glyph, typeChip?, title, meta, urgency?, actions, expanded }`. Renders inline action buttons when `expanded`, else a `⋯` overflow menu. Click/Enter → primary open (deep-link). |
| `ActionComposeModal.tsx` | Reply / take-action gist composer: a `Dialog` with a multiline "What should happen?" field + submit. **Stub:** on submit fires a toast ("Queued for the response skill — coming soon") and closes; no persistence yet. |
| `useQuickdrawPrefs.ts` | localStorage hook: `ea-quickdraw-expanded` (bool) + `ea-quickdraw-collapsed` (Set of section ids). Mirrors the existing `ea-feed-rail-collapsed` / `ea-theme` convention. |

## Sections & data (all existing endpoints)

**1. Needs Response** — merge of:
- `signals` where `status='new'` (`GET /api/signals?status=new`) — glyph by `source`/`type`, priority color; detail = who/what/why/`summary`.
- `alerts` where `status='unread'` (`GET /api/alerts`, filter client-side) — glyph by `severity`, `body` as detail.
- Ranked: priority/severity, then recency. Actions: **Reply** (signals) / **Take action** (alerts w/ url) → `ActionComposeModal`; **Silence**/**Dismiss** → status change.

**2. Approaching** — deadlines + tasks + events inside the workday horizon (reuse the SignatureBar horizon window + urgency helper), soonest-first. `TimelineTypeChip` for type; urgency-colored countdown. Actions: **Take action** → deep-link `?focus=id` to the item's view (the modal we already wired); **Dismiss/Complete** → status change where the table is status-whitelisted (tasks/events). Deadlines are open-only (no dismiss in Quickdraw).

**3. Recent Activity** — `GET /api/activity` (`skill_runs`), newest ~10. Row = ok/error glyph + skill name + relative time. Read-only (no actions).

Counts in each section header. Each section independently collapsible; collapse persisted.

## Quick actions

| Action | Applies to | Mechanism |
|--------|-----------|-----------|
| Silence | alerts, signals | `POST /api/{table}/{id}/status` → a "silenced"/"read" value the table allows; no confirm (reversible). |
| Dismiss / Remove | signals, tasks, events, alerts | `POST /api/{table}/{id}/status` → `dismissed`; **confirm modal** (guards accidental removal). |
| Reply | signals | `ActionComposeModal` (gist). Stub: toast + close. |
| Take action | alerts (w/ url), approaching items | If a deep-link target exists → navigate `?focus=id`; else `ActionComposeModal` (gist). Stub for the compose path. |

- All status mutations invalidate the relevant query keys (`['signals']`, `['alerts']`, `['tasks']`, etc.) so the row leaves the list.
- `ponytail:` comment on the compose stub naming the future `action_requests` wiring.

## Gunslinger treatment

- Masthead title **`QUICKDRAW`** in `"JetBrains Mono"`, letter-spaced, with a `Crosshair` (lucide) glyph in `var(--color-accent)`.
- Empty-state micro-copy, restrained: Needs Response → "Holstered — nothing to draw." · Approaching → "All quiet on the range." · Recent Activity → "No tracks yet."
- Action verbs stay literal (Silence / Dismiss / Reply / Take action). No audio, no gunfire animation, no theme-breaking color.

## Data flow

- Each section owns its query (`useQuery`, existing fetchers `getSignals`/`getAlerts`/`getDeadlines`/`getTasks`/`getEvents`/`getActivity`; add any missing thin fetchers to `api.ts`). Existing 15s `refetchInterval` + the SSE `db-changed` invalidation already in the app keep it live.
- Action → mutation → `invalidateQueries` on that key. Compose stub → toast only.
- `useQuickdrawPrefs` reads/writes localStorage synchronously; default = collapsed width, all sections open.

## Testing

- `Quickdraw`: renders masthead + 3 sections; expand toggle flips width + persists; desktop-only mount unaffected.
- `QuickdrawSection`: collapse toggles + persists; count; empty-state copy present; loading/error.
- `QuickdrawItem`: click → deep-link nav; inline actions visible when `expanded`, in `⋯` menu when not; status action calls the right endpoint; dismiss shows confirm.
- `ActionComposeModal`: submit fires toast, does not call a network endpoint (stub); closes.
- `useQuickdrawPrefs`: round-trips both keys.
- Migrated: the old `RightDrawer.test.tsx` is replaced by the Quickdraw tests; `App.tsx` mount still renders at `lg+`.
- `tsc -b` + `vitest run` + `npm run build` green; verify served bundle on `:8765`.

## Out of scope / deferred

- **`action_requests` backend** (table + endpoints + MCP `list_action_requests`/`resolve_action_request`) and the outbound **response-actions watcher skill** — a future dedicated sub-project. Quickdraw's compose modal is a UI stub until then.
- In-app email/Teams sending or Gmail-MCP drafting.
- Mobile/`<lg` presentation of Quickdraw (stays hidden below `lg`, as today).
- Notifications (sub-project B) and timeline attention-grabber (sub-project C) — separate specs.

## Global constraints

- React 19 + TypeScript + MUI v7 (**`sx` only, no system props**); TanStack Query; react-router v7; lucide-react (`style`/`size`, not `sx`).
- Theme-aware across all 5 themes (light+dark) via existing tokens (`var(--color-accent)`, `"JetBrains Mono", monospace`, palette `*-mainChannel` vars); `prefers-reduced-motion` respected.
- Reuse existing endpoints, fetchers, `TimelineTypeChip`, urgency helpers, and `?focus=id` deep-links — no new backend, no parallel data paths.
- Files under ~200 lines each; desktop-only (`lg+`) mount unchanged.
- `tsc`/`vitest`/`build` green before each commit; semantic commits; branch → verify → merge (no-ff); container verify on `:8765`.
