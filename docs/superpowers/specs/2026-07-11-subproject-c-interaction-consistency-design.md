# Sub-Project C — Interaction Consistency Design

Part of the [dashboard overhaul program](2026-07-11-dashboard-overhaul-design.md). Follows Sub-Project A (bug sweep) and B (multi-theme). Independent spec → plan → merge.

## Goal

Make list/tabular interaction uniform across the app: every tabular view is a MUI X DataGrid with hover-detail tooltips; tasks gain per-item editing; the activity log gets a first-class drill-down view.

## Scope (what's actually left)

Phases 1–3 + Sub-A already migrated most views to DataGrid + click-nav. Remaining gaps, confirmed by inventory:

1. **Calendar** — hand-rolled event cards (`views/Calendar.tsx`), no grid.
2. **Docs** — hand-rolled skill cards (`views/Docs.tsx`), no grid.
3. **Tasks** — DataGrid is read-only; only complete/dismiss. No field editing.
4. **Activity** — `ActivityWidget` rows are display-only; no drill-down target exists.

Out of scope: all other views (already DataGrid). No new charts. No FTS search (that is Sub-E).

## Backend reality (verified)

- **Tasks**: `GET /api/tasks` + status-only `POST /api/{table}/{id}/status`. **No field update.** → add `PATCH /api/tasks/{id}`. The column whitelist `_TASK_COLS` already exists (`backend/ea/db.py:224`), so `update_task` is a verbatim clone of `update_topic` (`db.py:335`); `TaskPatch` mirrors `TopicPatch` (`app.py:74`); the endpoint mirrors `update_topic_endpoint` (`app.py:272`).
- **Activity**: `GET /api/activity?limit=N` reads full `skill_runs` history ordered by `ran_at DESC`. **No new endpoint** — the `/activity` view calls `getActivity(200)`.

## Design

### 1. Calendar → DataGrid

Rows = events (`EventItem`). Columns:

| field | header | content |
|-------|--------|---------|
| `title` | Event | Tooltip (arrow) carries `body` + proposed times + attendee count; cell shows title |
| `chosen_time` | Time | `chosen_time` as a filled primary Chip, else `Unscheduled` muted caption |
| `status` | Status | outlined Chip |
| `actions` | — | `type: 'actions'` — Approve + Reject `GridActionsCellItem` **only when `status === 'suggested'`** (empty array otherwise) |

Keep `getEvents` query, `approveMutation`/`rejectMutation`, `parseJsonSafe`. Keep header, error alert, empty state. `getRowId` defaults (events have numeric `id`). Density compact, `disableColumnMenu`, pageSize 25.

Tooltip body (built per row from `parseJsonSafe`):
- `body` line if present
- proposed times joined (first 3 + `+N more`) if no `chosen_time`
- `N attendees` line if any

### 2. Docs → DataGrid

Rows = skills (`Skill`). Skills have **no numeric id** → `getRowId={(r) => r.name}`. Columns:

| field | header | content |
|-------|--------|---------|
| `name` | Skill | display-font cell |
| `description` | Description | Tooltip (arrow) carries full text; cell shows text (grid truncates) |
| `schedule` | Schedule | outlined Chip when present, else `—` |
| `actions` | — | `type: 'actions'` — Copy `GridActionsCellItem` → existing `copySkill(name, body)` |

Keep header ("Skills Library"), quickstart blurb Paper, loading/error/empty states. Density compact, `disableColumnMenu`, pageSize 25.

### 3. Tasks edit modal + PATCH

**Backend:**
- `db.update_task(conn, task_id, **fields)` — clone of `update_topic`, whitelist `_TASK_COLS`.
- `TaskPatch(BaseModel)`: `title/detail/due_at/priority/status` all `| None = None`.
- `PATCH /api/tasks/{task_id}` — mirror `update_topic_endpoint`: `exclude_none`, `update_task`, 404 on 0 rows, 400 on `sqlite3.Error`.

**Frontend:**
- `api.ts`: `updateTask(id, body: Partial<Task>) => patchJson<{updated:number}>(\`/api/tasks/${id}\`, body)` (`patchJson` already exists).
- `Tasks.tsx`: add edit Dialog (mirrors Topics) with fields Title / Detail (multiline) / Due (`type="date"`) / Priority (select 1–3) / Status (select open/in_progress/done/dismissed). Add `updateMutation`, `handleEdit`, `handleCloseDialog`, dialog state. Add an **Edit** `GridActionsCellItem` (pencil) as the first action; keep complete/dismiss. `due_at` ISO ↔ `yyyy-mm-dd` conversion for the date input.

### 4. /activity view + nav

**New `views/Activity.tsx`** — `ActivityView`, DataGrid of `getActivity(200)`. Rows = `Activity` (numeric `id`). Columns:

| field | header | content |
|-------|--------|---------|
| `status` | — | Check (success) / X (error) icon, width 40 |
| `skill` | Skill | monospace cell |
| `items_created` | Items | `type: 'number'` |
| `ran_at` | Ran | caption, localized |
| `note` | Note | Tooltip carries full note; cell shows note or `—` |

Header "Activity", error/empty states matching sibling views. Density compact, pageSize 25, sortable (default `ran_at` desc).

**Wiring:**
- `App.tsx`: lazy `ActivityView`, `<Route path="/activity" element={<ActivityView />} />` above the catch-all.
- `Sidebar.tsx`: nav item `{ id: 'activity', route: '/activity', icon: Activity, label: 'Activity' }` (lucide `Activity`), placed after `docs`.
- `ActivityWidget.tsx`: make the 5 summary rows navigate — wrap each row `Box` with `component={Link} to="/activity"` (matches TodayWidget pattern), keep Tooltip + hover.

### 5. Verification

Full BE (`pytest`) + FE (`vitest`) + `tsc -b` + `build`. Live sweep: Calendar/Docs/Tasks/Activity render as grids under one theme; task edit round-trips (open modal → change field → Save → grid reflects); activity widget row → `/activity`; sort/filter/tooltip work. Correct-bundle check (served vs built `index-*.js` hash; stop stale docker container first).

## Testing strategy

- **Backend**: `test_web_app.py`-style TestClient test — seed a task via `db.add_task`, `PATCH /api/tasks/{id}` changes a field, assert `{updated:1}` and the row changed; 404 for missing id; unknown column rejected (400 or ignored by whitelist).
- **Frontend**: per-view render tests (grid renders rows, tooltip present), task edit dialog opens + submits (mock `updateTask`), activity widget row is a link to `/activity`. Reuse existing test helpers/render wrappers.

## Global Constraints

- MUI v7: no Box/Typography system props — `sx` only.
- DataGrid: `density="compact"`, `disableColumnMenu`, `sx={{ border: 0 }}` — match existing views (Topics/Tasks).
- Skills have no `id` → `getRowId={(r) => r.name}` on the Docs grid (omitting it crashes DataGrid).
- Task edit reuses the People/Topics Dialog pattern verbatim — no inline cell editing.
- `patchJson` and `_TASK_COLS` already exist — reuse, do not reinvent.
- Preserve every existing handler (approve/reject, copy, complete/dismiss) and all loading/error/empty states.
- `npx tsc -b` is mandatory per task (vitest does not typecheck).
