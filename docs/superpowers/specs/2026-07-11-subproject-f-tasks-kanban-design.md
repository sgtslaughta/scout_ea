# Sub-Project F — Tasks Kanban Board Design

Final sub-project of the [dashboard overhaul program](2026-07-11-dashboard-overhaul-design.md). Replaces the Tasks tabbed DataGrid with a GitLab-style kanban board with user-defined columns and accessible drag-and-drop. **Tasks page only.**

## Decisions

- **DnD:** `@dnd-kit/core` (new dependency) — accessible (keyboard sensor), touch + mouse, smooth. ~10KB.
- **Columns:** user-defined board columns (not fixed statuses). New `board_columns` table + `tasks.board_column_id`. Users add / rename / delete / reorder columns. A card's column is independent of its `status` (status stays editable in the card modal; open/done semantics unchanged for other views).

## Backend

### Schema (`backend/ea/features.sql`, migration 004)

```sql
CREATE TABLE IF NOT EXISTS board_columns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Idempotent migration (`backend/ea/db.py` `init_db` → new `_migrate(conn)`)

Run after `executescript(features)`:
- If `tasks` has no `board_column_id` column (check `PRAGMA table_info(tasks)`), `ALTER TABLE tasks ADD COLUMN board_column_id INTEGER REFERENCES board_columns(id)`.
- If `board_columns` is empty, seed `To Do`(0), `In Progress`(1), `Done`(2), then map existing tasks: `open→To Do`, `in_progress→In Progress`, `done/dismissed→Done` (one-time, guarded by the empty check).

`ALTER TABLE ADD COLUMN` isn't `IF NOT EXISTS`-able, so the `PRAGMA` check is the idempotency guard — safe to run on every init.

### db helpers (`backend/ea/db.py`)

- `list_board_columns(conn)` → rows ordered by position, id.
- `add_board_column(conn, name)` → position = `max(position)+1`; returns id.
- `update_board_column(conn, id, **fields)` → whitelist `{name, position}`.
- `delete_board_column(conn, id)` → reassign its tasks to the lowest-position remaining column (or NULL if none), then delete.
- Add `board_column_id` to `_TASK_COLS` (enables PATCH to move a card).

### Endpoints (`backend/web/app.py`)

- `GET /api/board/columns` → `[{id, name, position}]`
- `POST /api/board/columns` `{name}` → `{id}`
- `PATCH /api/board/columns/{id}` `{name?, position?}` → `{updated}`
- `DELETE /api/board/columns/{id}` → `{deleted}`
- `PATCH /api/tasks/{id}` already exists; `board_column_id` now accepted (via `_TASK_COLS` + `TaskPatch` field).

## Frontend

### `api.ts`

- `Task` += `board_column_id?: number | null`.
- `BoardColumn { id, name, position }`.
- `getBoardColumns()`, `addBoardColumn(name)`, `updateBoardColumn(id, body)`, `deleteBoardColumn(id)`. `updateTask` already moves a card.

### `views/Tasks.tsx` — board

- Fetch `getTasks` + `getBoardColumns`. Group tasks by `board_column_id` (null → first column).
- `<DndContext>` (Pointer + Keyboard sensors). Each column = `useDroppable`; each card = `useDraggable`. On drag end over a column → `updateTask(taskId, { board_column_id })` (optimistic invalidate).
- **Card**: title, priority dot, due chip (friendly), status chip. Hover → Tooltip detail. Click → existing edit modal (reuse Sub-C dialog: title/detail/due/priority/status). Keep complete/dismiss as small card actions (set status via `setSignalStatus`).
- **Column header**: name + task count + a menu (rename, delete) + drag affordance to reorder columns (or ◀/▶ buttons — simplest accessible reorder). "Add column" control at the board's right edge.
- Remove the status `Tabs` + `DataGrid`. Keep the `?due=today` filter as a board-wide filter chip.
- Board scrolls horizontally (`overflow-x: auto`); columns fixed width (~280px).

### Column management

- Add: inline text field → `addBoardColumn`.
- Rename: click header → editable field → `updateBoardColumn(id, {name})`.
- Delete: header menu → confirm → `deleteBoardColumn` (cards reassigned server-side).
- Reorder: ◀/▶ buttons swap `position` with the neighbor via `updateBoardColumn` (keyboard-accessible; avoids a second dnd surface).

## Testing

- **backend `test_board.py`**: migration adds column idempotently; seed creates 3 columns + maps tasks; column CRUD (add/rename/reorder/delete-reassigns-cards); PATCH task board_column_id moves it; delete last column → tasks NULL.
- **frontend `Tasks.test.tsx`** (rework): board renders columns from API; a task appears under its column; the edit modal still opens on card click and submits (keep the Sub-C assertion); add-column calls `addBoardColumn`. (DnD drag itself is hard to unit-test — assert the move handler wiring via a direct call or skip, and rely on the review + live verify.)

## Global Constraints

- MUI v7 `sx` only. `@dnd-kit/core` is the only new dep.
- DnD must be keyboard-accessible (KeyboardSensor) — a11y basic.
- Card modal reuses the Sub-C dialog pattern verbatim — no second implementation.
- Board is horizontally scrollable; page body never scrolls sideways.
- Migration is idempotent (PRAGMA guard) — safe on existing DBs.
- `npx tsc -b` + `pytest` mandatory.
