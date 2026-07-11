# Scout EA Dashboard Overhaul — Design (Program + Sub-Project A)

**Date:** 2026-07-11
**Status:** Sub-Project A approved; B–F scoped, not yet designed.

## Program overview

A multi-part overhaul of the Scout EA frontend, decomposed into 6 sub-projects, each its own spec → plan → merge cycle (same cadence as the completed MUI migration Phases 1-3).

| # | Sub-project | Size | Notes |
|---|---|---|---|
| **A** | Bug sweep | small | **This spec.** Trending crash, dead controls, drawer nav. |
| B | Color palette + character | foundational | 5 candidate palettes (light+dark, fun→professional); texture/depth. Built before feature work so later UI uses the new system. |
| C | Interaction consistency | medium | Remaining tables → DataGrid, click-nav + hover-detail everywhere, task item editing. |
| D | Workday bar redesign | medium | Deadline-mapped progress bar, proximity color/animation, live time marker, hover/click. |
| E | Super search | medium | SQLite FTS5 `/api/search` across all entities + section results UI; search icon + tooltip. |
| F | Tasks kanban board | large | Replace the Tasks tabbed view with a GitLab-style multi-column drag-and-drop board; custom columns; hover-detail; click-edit modal. (Scoped to the Tasks page only — not a nav replacement.) |

Sequencing (user-confirmed): **A → B → then C/D/E/F.**

### Decisions locked (user)
- Kanban is the **Tasks page only**, GitLab-issue-board style, custom columns, drag-drop, hover-detail, click-edit modal. Other routed views stay.
- Palette: derive from current accent but present **5 distinct, industry-common palettes** working in light+dark, spanning fun/whimsical → professional; user picks (Sub-Project B).
- Search: **SQLite FTS5 backend endpoint** (Sub-Project E).

---

## Sub-Project A — Bug Sweep

Fix a batch of broken/dead UI, and add the missing safety net that let one bad view blank the whole app.

### A1. Trending white screen (crash)

**Root cause:** `frontend/src/views/Trending.tsx` uses `bgcolor: 'bg.main'` (2 places: the error branch and the main return). `bg` is not a palette namespace — the theme defines `background.default`/`paper`. MUI's sx resolver evaluates `theme.palette.bg.main` → `theme.palette.bg` is `undefined` → `.main` throws `TypeError` during render. With no route-level error boundary, the thrown error unmounts the whole React tree → white screen.

**Fix:** replace both `bgcolor: 'bg.main'` with `bgcolor: 'background.default'`.

### A2. Route error boundary (durable safety net)

**Problem:** only `WidgetCard` has an error boundary. Any routed view that throws blanks the app.

**Fix:** create `frontend/src/components/RouteErrorBoundary.tsx` — a class component (`getDerivedStateFromError`) rendering an MUI `Alert severity="error"` fallback with the view name, the error message, and a "Reload view" button (resets boundary state + re-renders). Wrap the `<Routes>` element in `App.tsx` with it (keyed on the current pathname via a small wrapper so navigating away clears a caught error). One failing view degrades to an inline Alert, never a white screen.

### A3. Hamburger menu (dead control)

**Problem:** `App.tsx` holds `collapsedSidebar` state and passes `collapsed`/`onToggle` to `Sidebar`, but `Sidebar` renders a fixed 56px icon rail regardless — the toggle does nothing visible.

**Fix:** Sidebar reads `collapsed`. `collapsed === true` (default) = today's 56px icon-only rail. `collapsed === false` = ~200px rail: same icons with text labels to their right (nav label per item; Help/menu labels too). Width animates via MUI transition. Persist the choice to `localStorage` key `ea-sidebar-collapsed`; `App.tsx` initializes state from it. Active-route highlight and tooltips (collapsed only) preserved.

### A4. Help button (dead control)

**Problem:** `Sidebar.tsx` Help `IconButton` has no `onClick`.

**Fix:** add a `HelpDialog` (MUI `Dialog`) opened from the Help button. Content: a keyboard-shortcuts list (⌘K command palette, theme toggle), a one-paragraph "What is Scout EA," and a text link that navigates to `/docs`. Closed via Cancel/Escape/backdrop.

### A5. Add-widget affordance (confusing dead-end)

**Problem:** the dashboard's "Add widget" button is disabled whenever no widget is hidden (the default), reading as broken.

**Fix:** replace with an always-enabled **"Manage widgets"** button opening a `Menu` that lists **all** registered widgets, each with a visibility checkbox (`MenuItem` + `Checkbox`) — checking shows, unchecking hides. Uses the existing `setWidgetHidden` layout function. Reset action retained. Removes the disabled state entirely.

### A6. Test notification (silent no-op)

**Problem:** "Send test" calls `POST /api/push/test`; with zero registered subscriptions it succeeds with `sent: 0` and nothing appears, so it reads as dead.

**Fix (frontend only):** the backend `/api/push/test` route exists (`backend/web/app.py:311`), so this is purely a frontend surfacing fix. `Settings.tsx` test handler surfaces the real result — `toast.success(\`Sent to ${sent} subscription(s)\`)` when `sent > 0`, and `toast.info('No active subscriptions — enable notifications first (requires a real browser + push service)')` when `sent === 0`. Real end-to-end delivery still requires a browser that completed push opt-in against a live push service — environmental, out of scope to fully exercise here.

### A7. Right-drawer: click-to-nav + hover-detail

**Problem:** `RightDrawer.tsx` deadline and trend items are static — no navigation, no detail on hover.

**Fix:** wrap each deadline item so click navigates to `/deadlines` (pointer cursor, hover background via `action.hover`); wrap in a `Tooltip` whose content shows title, absolute due date, full countdown, and source. Trend items: click → `/trending`; `Tooltip` with term, kind, score, and window. Uses `useNavigate` (drawer is inside the router).

### Architecture / boundaries

- New file: `RouteErrorBoundary.tsx` (one responsibility: catch + fallback + reset).
- New file: `HelpDialog.tsx` (self-contained content + open/close via props).
- Modified: `Trending.tsx` (A1), `App.tsx` (A2 wrap + A3 state init), `Sidebar.tsx` (A3 labels + A4 help wire), `Dashboard.tsx` (A5 manage-widgets menu), `Settings.tsx` (A6 toast), `RightDrawer.tsx` (A7 nav+tooltip).
- No backend change expected (A6 verifies an existing route; adds it only if absent).
- No palette/design-system change — that is Sub-Project B. Use existing theme tokens.

### Error handling

- A2 is itself the error-handling improvement. Fallback Alert is theme-aware, works both modes.
- Data-fetch errors keep existing TanStack Query behavior.

### Testing

- `RouteErrorBoundary`: a child that throws renders the Alert fallback (spy-silence console.error); "Reload view" clears state.
- Sidebar collapse: toggling `collapsed` prop shows/hides labels and changes width; localStorage round-trip.
- HelpDialog: opens on Help click, shows shortcuts, /docs link navigates, closes.
- Manage-widgets: menu lists all widgets; toggling a checkbox hides/shows and persists to `ea-dashboard-layout`.
- RightDrawer: deadline/trend items are links with correct `href`; tooltip content present.
- Settings test-notif: `sent > 0` and `sent === 0` produce the right toast (mock `sendTestPush`).
- Every change: `npx vitest run`, `npx tsc -b`, `npm run build` all green. Visual: screenshot Trending (no longer blank), expanded sidebar, help dialog, manage-widgets menu — dark + light.

### Out of scope (deferred to later sub-projects)

Palette/texture (B), DataGrid conversions + universal click-nav/hover beyond the drawer (C), workday bar (D), search (E), kanban (F).
