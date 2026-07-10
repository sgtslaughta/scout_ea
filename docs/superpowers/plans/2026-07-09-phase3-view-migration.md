# Phase 3 — View Migration + Legacy Dep Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 9 remaining Tailwind-era views to MUI (DataGrid for lists, MUI forms/dialogs for CRUD), delete dead code, then remove tailwindcss/recharts/framer-motion and their satellites — leaving one design system.

**Architecture:** Each view keeps its data layer (TanStack Query hooks, `api.ts` fetchers, query-param drill-down parsing from Phase 2) and swaps only presentation: Tailwind classNames → MUI components/sx. DataGrid Community replaces hand-rolled list markup where rows are tabular; MUI Dialog + TextField forms replace custom CRUD markup. Deadlines is migrated first as the fully-specified reference; subsequent view tasks follow its established pattern plus the Phase 2 widget conventions already in `src/widgets/`.

**Tech Stack:** MUI v7, MUI X DataGrid v9 (Community), react-router, TanStack Query, vitest.

## Global Constraints

- MUI X **Community/MIT only** — no `-pro` imports (no row grouping, tree data, aggregation, pinned columns).
- **Preserve behavior**: every existing query/mutation call, the Phase 2 query-param contracts (`due=24h`, `dir=rising`, `status`, `type=proactive`, `due=today`) with their dismissible Chips, and all existing test-verified behaviors. Migration = presentation only unless a task says otherwise.
- **MUI v7 has no Typography/Box system props** — `fontFamily`/`fontWeight`/`display` etc. go in `sx` (Phase 2 lesson).
- **CSS vars `--color-accent` and `--color-accent-2` must survive** — charts, horizon bar, and accent personalization (`applyAccent`) depend on them. The final cleanup keeps a plain `:root`/`:root.light` token block in `index.css`.
- Before EVERY commit, all three green: `npx vitest run`, `npx tsc -b`, `npm run build` (from `frontend/`). tsc is mandatory — vitest does not typecheck.
- Backend suite untouched: `cd backend && python -m pytest -q` → 139 passing at final verification.
- Files under 500 lines. Semantic commits. Branch: `phase3-view-migration` from master.
- UI rubric per view (user-mandated): CRUD symmetry (create⇒edit⇒delete), element placement sensible, colors correct BOTH modes, undo/cancel/confirm for destructive actions, informative titles + tooltips on icon-only controls, empty/loading/error states.
- Status colors (error/warning/success/info) reserved for status semantics; accent = `primary`.
- **Deviation from spec (approved rationale):** no TreeView — spec conditioned TreeView on hierarchical data ("where data is nested"); Docs and Topics data are flat lists. DataGrid/List instead.

## Shared conventions (all view tasks)

- Grid usage: `<DataGrid rows columns loading density="compact" disableColumnMenu sx={{ border: 0 }} />` with `hideFooter` when the view has ≤ ~25 rows typical; otherwise `pageSizeOptions={[25, 50]}` + `initialState.pagination.paginationModel.pageSize: 25`.
- Row actions: `GridActionsCellItem` inside a `type: 'actions'` column (keeps keyboard support), each with `label` and icon.
- Peeks: rich `Tooltip` on the title cell (pattern: `src/widgets/DeadlinesWidget.tsx`).
- Forms: MUI `Dialog` + `TextField`/`Select`/`Switch` + `DialogActions` (Cancel + primary). Destructive ops get a confirm Dialog.
- Filter chips for query params: existing Phase 2 code — keep as-is.
- Tests: keep every existing behavioral assertion (adjust selectors from Tailwind classes to roles/text). DataGrid renders rows async — use `findBy*`.
- View files import nothing from `tailwind` classes when done: `grep -c "className=" <view>` must reach 0 (MUI `className` for third-party is fine but shouldn't be needed).

---

### Task 1: Deadlines → DataGrid + MUI form (reference migration)

**Files:**
- Rewrite presentation: `frontend/src/views/Deadlines.tsx` (272 lines, 5 useState)
- Modify: `frontend/src/views/Deadlines.test.tsx` (142 lines — selectors only; every behavioral assertion stays)

**Interfaces:**
- Consumes: existing `getDeadlines`, `addDeadline(title, due_at, detail?)`, `setDeadlineVisible(id, visible)` from `@/api`; `useSearchParams` due=24h logic (keep verbatim); MUI + DataGrid.
- Produces: the reference pattern all later view tasks follow (columns array, actions column, add-dialog, chip filter placement).

- [ ] **Step 1: Read the current view + test.** List every behavior: fetch + sort, urgent styling, add-deadline form fields (title/due/detail), visibility toggle (eye icon), "Show all deadlines" toggle, due=24h chip, empty/loading states. Update the test file FIRST (TDD): keep all behavioral tests, convert selectors to role/text queries that will match the MUI version, run to see which fail against old markup (some will pass already — fine; the red step is the MUI-only selectors).

- [ ] **Step 2: Rewrite the view.** Structure:

```tsx
// Layout skeleton (data hooks + param logic unchanged, above this):
<Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
    <Typography variant="h5">Deadlines</Typography>
    <Box sx={{ flex: 1 }} />
    <FormControlLabel control={<Switch checked={showAll} onChange={...} />} label="Show all" />
    <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Add deadline</Button>
  </Box>
  {urgentOnly && <Chip label="Due <24h" onDelete={() => setSearchParams({})} size="small" sx={{ mb: 1 }} />}
  <DataGrid rows={visibleDeadlines} columns={columns} loading={isLoading} density="compact"
    disableColumnMenu pageSizeOptions={[25, 50]}
    initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
    sx={{ border: 0 }} />
</Box>
```

Columns (exact):

```tsx
const columns: GridColDef<Deadline>[] = [
  { field: 'title', headerName: 'Deadline', flex: 1, renderCell: /* Tooltip peek: title, detail, source (widget pattern) */ },
  { field: 'due_at', headerName: 'Due', width: 170, renderCell: (p) => new Date(p.value).toLocaleString() },
  { field: 'countdown_seconds', headerName: 'In', width: 100, renderCell: /* formatCountdown + color: overdue error.main, <24h warning.main, else text.secondary */ },
  { field: 'status', headerName: 'Status', width: 110, renderCell: (p) => <Chip size="small" variant="outlined" label={p.value} color={p.row.countdown_seconds <= 0 ? 'error' : 'default'} /> },
  { field: 'actions', type: 'actions', width: 70, getActions: (p) => [
      <GridActionsCellItem icon={<Eye size={16} />} label={p.row.visible ? 'Hide deadline' : 'Show deadline'} onClick={() => toggleVisible(p.row)} showInMenu={false} />,
  ]},
]
```

Add dialog (exact fields, native datetime input inside TextField):

```tsx
<Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
  <DialogTitle>Add deadline</DialogTitle>
  <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
    <TextField label="Title" value={title} onChange={...} autoFocus required />
    <TextField label="Due" type="datetime-local" value={dueAt} onChange={...} required slotProps={{ inputLabel: { shrink: true } }} />
    <TextField label="Detail" value={detail} onChange={...} multiline rows={2} />
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setAddOpen(false)}>Cancel</Button>
    <Button variant="contained" disabled={!title || !dueAt} onClick={submit}>Add</Button>
  </DialogActions>
</Dialog>
```

Keep the existing mutation/invalidation logic verbatim. `formatCountdown` may be imported from `@/widgets/DeadlinesWidget` (already exported) — do not duplicate it.

- [ ] **Step 3: All three checks**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green; Deadlines tests (incl. due=24h param test) pass against MUI markup. `grep -c "className=" src/views/Deadlines.tsx` → 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Deadlines.tsx frontend/src/views/Deadlines.test.tsx
git commit -m "refactor(frontend): Deadlines view on MUI DataGrid + form dialog"
```

---

### Task 2: Inbox + Tasks → DataGrid

**Files:**
- Rewrite presentation: `frontend/src/views/Inbox.tsx` (172), `frontend/src/views/Tasks.tsx` (166)
- Modify: `frontend/src/views/Inbox.test.tsx`, `frontend/src/views/Tasks.test.tsx` (selectors only)

**Interfaces:**
- Consumes: Task 1's reference pattern; existing `getSignals`, `setSignalStatus`, `getTasks` calls; Phase 2 param logic (`status`, `type=proactive`, `due=today`) verbatim.
- Produces: nothing new — pattern consumers only.

- [ ] **Step 1: Read both views + tests; update tests first (behavioral assertions preserved, selectors → role/text).** Existing behaviors to keep — Inbox: status tabs (New/Triaged/Actioned/Dismissed), per-row Dismiss/Triage actions calling `setSignalStatus`, priority indicator, proactive chip filter. Tasks: status filter, due-today chip, priority display, complete/status actions if present.

- [ ] **Step 2: Rewrite Inbox.** Status tabs → MUI `<Tabs value={activeStatus} onChange={...}><Tab value="new" label="New" />…</Tabs>`. Rows → DataGrid, columns: priority dot (SignalsWidget pattern), title w/ Tooltip peek (source · skill · created), tags/source `Chip size="small" variant="outlined"`, created_at relative time (`relativeTime` import from `@/widgets/SignalsWidget` — already exported), actions column: `GridActionsCellItem` Dismiss (X icon, label "Dismiss signal") + Triage (Check icon, label "Triage signal") wired to the existing `setSignalStatus` mutation.

- [ ] **Step 3: Rewrite Tasks.** Same shape: DataGrid columns title (+peek incl. detail), due_at (formatted, color warning.main when today, error.main when past), priority (`Chip` P1/P2/P3 — color error only for P1), status chip, actions (existing status transitions as `GridActionsCellItem`s). Keep due-today chip + activeStatus filter logic verbatim.

- [ ] **Step 4: All three checks** (`npx vitest run && npx tsc -b && npm run build`) — green; `grep -c "className=" src/views/Inbox.tsx src/views/Tasks.tsx` → 0 each.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Inbox.tsx frontend/src/views/Tasks.tsx frontend/src/views/Inbox.test.tsx frontend/src/views/Tasks.test.tsx
git commit -m "refactor(frontend): Inbox + Tasks views on MUI DataGrid"
```

---

### Task 3: People + Topics → DataGrid + CRUD dialogs

**Files:**
- Rewrite presentation: `frontend/src/views/People.tsx` (275), `frontend/src/views/Topics.tsx` (270)
- Modify: `frontend/src/views/People.test.tsx`, `frontend/src/views/Topics.test.tsx`

**Interfaces:**
- Consumes: Task 1 pattern; existing full CRUD: `getPeople/addPerson/updatePerson/deletePerson`, `getTopics/addTopic/updateTopic/deleteTopic` (delete = soft-deactivate), include-inactive toggles.
- Produces: nothing new.

- [ ] **Step 1: Read both views + tests; update tests first.** These views have full CRUD — the UI rubric applies hardest here: every row must expose Edit and Delete; Delete gets a confirm Dialog naming the row ("Deactivate Jane Doe?"); Cancel everywhere; form dialogs validate required name.

- [ ] **Step 2: Rewrite People.** DataGrid columns: name (+Tooltip peek w/ notes), role, org, importance (Rating or numeric Chip — match existing semantics; if existing UI is a number, keep a number), active (Chip when include-inactive on), actions: Edit (Pencil, opens dialog pre-filled → `updatePerson`), Delete (Trash2, confirm dialog → `deletePerson`). Header row: title, include-inactive `Switch`, "Add person" `Button` → same dialog empty. One dialog component per view, `initial?: Person` prop decides add vs edit.

- [ ] **Step 3: Rewrite Topics.** Same structure: name (+peek w/ description), priority, max_suggest, active; Edit/Delete actions w/ confirm; Add-topic button. Numeric fields = `TextField type="number"` with `slotProps={{ htmlInput: { min: … } }}` matching existing bounds.

- [ ] **Step 4: All three checks** — green; `grep -c "className=" src/views/People.tsx src/views/Topics.tsx` → 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/People.tsx frontend/src/views/Topics.tsx frontend/src/views/People.test.tsx frontend/src/views/Topics.test.tsx
git commit -m "refactor(frontend): People + Topics views on MUI DataGrid + CRUD dialogs"
```

---

### Task 4: Trending + Docs → MUI

**Files:**
- Rewrite presentation: `frontend/src/views/Trending.tsx` (98), `frontend/src/views/Docs.tsx` (96)
- Modify: `frontend/src/views/Trending.test.tsx`, `frontend/src/views/Docs.test.tsx`

**Interfaces:**
- Consumes: Task 1 pattern; `getTrends`, docs fetching as-is; `dir=rising` param logic verbatim.
- Produces: nothing new.

- [ ] **Step 1: Read + update tests first.** Trending keeps: score display, delta chips, rising filter chip, any window selector. Docs keeps: doc list + whatever viewer exists.

- [ ] **Step 2: Rewrite Trending.** DataGrid columns: term (+peek: kind, window, sources), score (right-aligned, mono via sx), delta (Chip pattern from `src/widgets/TrendingWidget.tsx` — import nothing, small duplication of a 5-line chip is fine here), count. Keep "Rising" chip.

- [ ] **Step 3: Rewrite Docs.** Flat data → MUI `List`/`ListItemButton` (or DataGrid if current UI is tabular — match whichever the current view is) + existing content pane restyled with `Paper`/`Typography`. No TreeView (flat data — see Global Constraints deviation).

- [ ] **Step 4: All three checks** — green; className grep → 0 for both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Trending.tsx frontend/src/views/Docs.tsx frontend/src/views/Trending.test.tsx frontend/src/views/Docs.test.tsx
git commit -m "refactor(frontend): Trending + Docs views on MUI"
```

---

### Task 5: Calendar + Settings → MUI

**Files:**
- Rewrite presentation: `frontend/src/views/Calendar.tsx` (151), `frontend/src/views/Settings.tsx` (230)
- Modify: `frontend/src/views/Calendar.test.tsx`, `frontend/src/views/Settings.test.tsx`

**Interfaces:**
- Consumes: `getEvents`; Settings' existing `useColorScheme` + `applyAccent` wiring (Phase 1 — keep verbatim); Web Push opt-in logic in Settings (keep verbatim, restyle only).
- Produces: nothing new.

- [ ] **Step 1: Read + update tests first.** Settings test already covers mode→localStorage; keep it green.

- [ ] **Step 2: Rewrite Calendar.** Month grid stays custom (spec: "custom month grid restyled with MUI primitives"): CSS grid via `Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}`, day cells = `Paper variant="outlined"`, today highlighted `borderColor: 'primary.main'`, events as small Chips with Tooltip peek (title, time, attendees). Month nav = `IconButton` chevrons + `Typography variant="h6"` month label.

- [ ] **Step 3: Rewrite Settings.** Sections → `Paper variant="outlined"` blocks with `Typography variant="overline"` headers. Theme mode → `ToggleButtonGroup exclusive` (Dark/Light/System). Accent swatches → row of `IconButton`s with check on active (keep `applyAccent` call). Notifications → `Button` + status `Chip` (keep push logic verbatim).

- [ ] **Step 4: All three checks** — green; className grep → 0 for both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Calendar.tsx frontend/src/views/Settings.tsx frontend/src/views/Calendar.test.tsx frontend/src/views/Settings.test.tsx
git commit -m "refactor(frontend): Calendar + Settings views on MUI"
```

---

### Task 6: Shell leftovers + dead code

**Files:**
- Modify: `frontend/src/components/TodayBriefing.tsx` (inner content → MUI; Dialog shell already done in Phase 1)
- Modify: `frontend/src/components/CommandPalette.tsx` (cmdk stays; Tailwind classes → sx/styled on the cmdk elements)
- Delete: `frontend/src/components/SkeletonRow.tsx`, `frontend/src/components/SkeletonRow.test.tsx` (MUI `Skeleton` replaces; fix any importers)
- Delete: `frontend/src/views/Today.tsx`, `frontend/src/views/Today.test.tsx` (orphaned — verify with grep first)
- Delete: `frontend/src/views/ComingSoon.tsx` IF `grep -rn "ComingSoon" src` shows no imports (verify first; if imported, migrate it instead: `Box` + `Typography`)

**Interfaces:**
- Consumes: MUI only.
- Produces: zero Tailwind classNames under `src/components/`; no orphaned files.

- [ ] **Step 1: Verify orphans**

```bash
cd frontend && grep -rn "views/Today'" src; grep -rn "ComingSoon" src; grep -rn "SkeletonRow" src
```

Delete what nothing imports; replace `SkeletonRow` usages (if any remain) with `<Skeleton variant="rounded" height={40} />`.

- [ ] **Step 2: TodayBriefing inner content → MUI** (Typography/Stack/Chip/List; keep all data logic + auto-open contract `ea-briefing-shown`).

- [ ] **Step 3: CommandPalette** — keep cmdk component + keyboard behavior; move visual styling to MUI `Paper`/`InputBase`/sx so no Tailwind classes remain.

- [ ] **Step 4: All three checks** + `grep -rn "className=" src/components/ src/views/ | grep -v node_modules` → empty.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(frontend): MUI briefing/palette, drop SkeletonRow + orphaned views"
```

---

### Task 7: Remove legacy dependencies + CSS cleanup

**Files:**
- Modify: `frontend/package.json` (via npm uninstall), `frontend/vite.config.ts`, `frontend/src/index.css`
- Delete: `frontend/src/App.css` (verify importers first), `frontend/postcss.config.*` if tailwind-only

**Interfaces:**
- Consumes: everything above complete (zero Tailwind class usage).
- Produces: final dependency set; `index.css` with fonts + `:root` token block only.

- [ ] **Step 1: Prove nothing uses them**

```bash
cd frontend && grep -rn "framer-motion\|recharts\|tailwind\|class-variance-authority\|@radix-ui" src && echo "STILL USED — STOP" || echo clean
```

Expected: `clean`. If not, fix the stragglers first (report DONE_WITH_CONCERNS if unexpected usage found).

- [ ] **Step 2: Uninstall**

```bash
npm uninstall tailwindcss @tailwindcss/vite @tailwindcss/postcss tailwindcss-animate recharts framer-motion class-variance-authority @radix-ui/react-dialog autoprefixer postcss
```

(`autoprefixer`/`postcss` only if nothing else needs them — check `postcss.config` and vite config; Vite handles prefixing for modern targets.)

- [ ] **Step 3: vite.config.ts** — remove the `@tailwindcss/vite` plugin import + usage.

- [ ] **Step 4: index.css** — replace Tailwind-era content with (exact):

```css
@import "@fontsource/space-grotesk/400.css";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/600.css";
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/500.css";

/* Chart + horizon + accent-personalization tokens (MUI palette covers everything else) */
:root {
  --color-accent: #F2A65A;
  --color-accent-2: #6C8FE5;
}
:root.light {
  --color-accent: #E67E22;
  --color-accent-2: #3498DB;
}

#root {
  width: 100%;
  height: 100vh;
  display: flex;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

(CssBaseline + theme handle body/background/typography; `:focus-visible` handled by MUI focus rings.) Delete `App.css` and its import in `App.tsx`.

- [ ] **Step 5: All three checks + backend suite**

```bash
cd frontend && npx vitest run && npx tsc -b && npm run build
cd ../backend && source ../.venv/bin/activate && python -m pytest -q
```

Expected: all green. Record `ls -la frontend/dist/assets/*.js | sort -k5 -n | tail -5` — expect main chunk to DROP (Tailwind CSS + framer-motion gone).

- [ ] **Step 6: Commit**

```bash
git add -A frontend
git commit -m "chore(frontend): remove tailwind/recharts/framer-motion — single design system"
```

---

### Task 8: Verification — full visual sweep

**Files:** none.

- [ ] **Step 1: Suites** (already green from Task 7; re-run all three + backend once on the final tree).

- [ ] **Step 2: Deploy + live sweep**

```bash
cd /home/user/code/Scout_EA && rm -rf frontend_dist && cp -r frontend/dist frontend_dist
source .venv/bin/activate && python -c "import sys; sys.path.insert(0, 'backend'); import seed_demo; seed_demo.seed('ea.sqlite')"
python backend/run_web.py &   # :8765 — REMEMBER: serves frontend_dist/, not frontend/dist
```

Playwright screenshots (established script pattern: chromium `/usr/bin/google-chrome`, addInitScript ea-theme + ea-briefing-shown, run from `frontend/`): ALL 10 routes (`/`, `/inbox`, `/tasks`, `/calendar`, `/trending`, `/deadlines`, `/people`, `/topics`, `/docs`, `/settings`) in dark AND light → `frontend/screenshots/phase3-<view>-<mode>.png`. Check each against the UI rubric: colors both modes, CRUD controls visible (People/Topics edit+delete), dialogs open (screenshot one add-dialog + one delete-confirm), filter chips on param routes, empty/loading absent with seeded data.

- [ ] **Step 3: Interaction spot-checks** (Playwright): open People add-dialog and submit a row; toggle a deadline's visibility; dismiss an inbox signal — assert row count changes. Kill server after.

- [ ] **Step 4: Bundle + ledger** — record final sizes vs Phase 2 (main 385KB baseline); note CI green expectation; merge per repo convention (no-ff to master).

---

## Self-Review Notes

- Spec coverage: DataGrid for Inbox/Tasks/Deadlines/Trending/People/Topics (T1-T4), MUI forms Settings (T5), Calendar custom grid w/ MUI primitives (T5), query-param contract preserved (all tasks), cleanup of tailwind/recharts/framer-motion once unused (T7), bundle before/after (T7/T8). TreeView dropped — spec's own condition ("where data is nested") unmet; documented in Global Constraints.
- Docs/Today/ComingSoon: Today.tsx verified orphaned (no imports); ComingSoon verified at execution (T6 Step 1 greps before deleting).
- View tasks give exact component mappings + full code for novel structures (Task 1 reference, dialogs, index.css) rather than blind full-file rewrites — Phase 2 showed plan-authored full code without reading the target files injects API bugs; implementers on these tasks read the real file first and are sonnet-tier.
- Type consistency: imports reuse Phase 2 exports (`formatCountdown` from DeadlinesWidget, `relativeTime` from SignalsWidget) — both verified exported.
