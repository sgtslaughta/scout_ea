# Frontend Consolidation (Option B) — Design

**Date:** 2026-07-12
**Status:** Approved (design), pending implementation planning
**Type:** Program (5 sub-projects, each own plan → PR)
**Scope:** Frontend only. No backend/API changes.

## Problem

App organized by **data-type**, not by **job**. Each data type got its own page; each page's data then leaked into shared surfaces. Two redundancy dimensions:

1. **Five competing overview surfaces** — Dashboard (widget grid), SignatureBar (top timeline), Quickdraw (right drawer), TodayBriefing (daily modal), Command palette — each hand-rolls its own slice of the same tasks/deadlines/signals/activity data.
2. **Same data type in 3–4 places** — e.g. a deadline appears in Deadlines view + Dashboard widget + SignatureBar flank + Quickdraw approaching. Shape change = fix in 4 spots.

Current sidebar: 11 flat items (Dashboard, Inbox, Tasks, Actions, Calendar, Data Feed, Deadlines, People, Skills, Activity, Settings).

Existing assets that make this cheap: `widgets/registry.ts` (widget registry primitive), prior merge precedent (`/trending`+`/topics`→`/feed`, `/docs`→`/skills`).

## Goals

- Fewer nav destinations, grouped.
- One source of truth per data type — stop rendering the same info N ways.
- Fewer clicks: "what needs my decision" and "my time" each have ONE home.
- Consistent shell/pattern across surfaces.

## Non-goals

- No backend or API changes.
- No new data models.
- Not adopting command-first/canvas nav (Option D) — deferred.
- Tasks stays a standalone nav item (not folded into Schedule this program).

## Target navigation

11 → 8 items, grouped:

```
WORK       Home · Review · Tasks · Schedule
KNOWLEDGE  Feed · People
SYSTEM     Automations · Settings
```

## Cross-cutting decision: aggregators

**Registry-unify all, keep placements** (lowest risk). Dashboard, Quickdraw, and TodayBriefing all render from `widgets/registry.ts` with density variants. Placements stay (Dashboard = full grid, Quickdraw = compact column, Briefing = daily snapshot); bespoke aggregation logic is deleted. SignatureBar and Command palette keep their distinct roles (horizon timeline / search) but are not additional aggregation code paths.

## The merges

**Calendar splits by job (dissolves entirely):**
- Event *proposals awaiting approval* → **Review** (a decision).
- *Confirmed* events → **Schedule** (a commitment).

| Sub-project | Merge | Shape |
|---|---|---|
| **SP-1 Registry unification** | Dashboard + Quickdraw + Briefing → one registry w/ density variants | delete bespoke aggregation in `quickdrawData.ts` + `TodayBriefing` |
| **SP-2 Schedule** | Deadlines + confirmed Calendar events | one time view; deadlines & events as filterable entity types on shared timeline/list |
| **SP-3 Review** | Inbox + Actions + Calendar proposals | one "awaiting my decision" queue; status tabs (new/triaged/actioned/dismissed) |
| **SP-4 Automations** | Skills + Activity | two tabs: Library + Run History |
| **SP-5 Nav/routing cleanup** | Sidebar → 8 grouped; auto-gen Sidebar + CommandPalette from one route config; redirects for old paths; delete `/docs` | shell only |

## Order & parallelism

1. **SP-1 first** — foundation, removes most duplication, de-risks later view moves.
2. **SP-2 / SP-3 / SP-4** — independent, parallelizable.
3. **SP-5 last** — needs merged views to exist.

## Affected surfaces

- **Views:** Deadlines+Calendar→Schedule; Inbox+Actions→Review; Skills+Activity→Automations. Tasks / Feed / People / Settings untouched as views.
- **Shell:** `Sidebar.tsx`, `CommandPalette.tsx`, `App.tsx` routes (+redirects so bookmarks/`⌘K` deep links survive).
- **Overview:** `widgets/registry.ts` (single source), `components/quickdraw/*`, `components/TodayBriefing.tsx`.
- **Backend:** none.

## Route migration (preserve deep links)

Old → new redirects in `App.tsx`:
- `/deadlines` → `/schedule`
- `/calendar` → `/schedule` (confirmed) ; proposals reachable via `/review`
- `/inbox` → `/review`
- `/actions` → `/review`
- `/skills` → `/automations`
- `/activity` → `/automations?tab=history`
- `/docs` → delete (already redirects to `/skills`)

## Risks / watch-items

- **Schedule:** events vs deadlines are 2 data models — keep as tagged entity types on one screen; do NOT force a fake union schema.
- **Review:** 3 item kinds (signal / action / proposal) need consistent action affordances — reuse `ActionMenu` / `ActionBadge` / `useEntityActions`.
- **Density:** merged views hold more — tabs/filters must be crisp, not cramped. Lean on existing DataGrid + Dialog patterns.
- **Registry density variants:** ensure a widget with no compact variant degrades gracefully in Quickdraw/Briefing.

## Success criteria

- Sidebar shows 8 grouped items.
- No data type rendered by more than one aggregation code path (registry is the only one).
- Old routes redirect; no broken `⌘K` nav or bookmarks.
- All existing tests green; merged views retain prior view test coverage.
- No backend diff.

## Forward-compat note

SP-2/3/4's merged views ("Schedule / Review / Automations") map cleanly onto a later Option-C verb-based IA ("Plan / Triage / Automate"). This program is C's foundation, not a detour — no rework required to reskin later.
