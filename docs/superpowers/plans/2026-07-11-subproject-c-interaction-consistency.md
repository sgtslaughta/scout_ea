# Sub-Project C — Interaction Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uniform tabular interaction — Calendar + Docs become DataGrids, Tasks gains an edit modal (with a backend PATCH), and Activity gets a first-class drill-down view.

**Architecture:** Frontend-heavy. One small backend addition (task PATCH) cloned from the existing topic-update path. All grids reuse the Topics/Tasks DataGrid idiom; the task modal reuses the Topics add/edit Dialog idiom.

**Tech Stack:** React 19 + TS, MUI v7, MUI X DataGrid v9, TanStack Query, react-router v7, FastAPI, SQLite, vitest, pytest.

## Global Constraints

- MUI v7: no Box/Typography system props — `sx` only.
- Every DataGrid: `density="compact"`, `disableColumnMenu`, `sx={{ border: 0 }}` — match Topics.tsx.
- Docs grid MUST set `getRowId={(r) => r.name}` (skills have no `id`; omitting crashes DataGrid).
- Task editing reuses the People/Topics Dialog pattern — NO inline cell editing.
- `patchJson` (api.ts:142) and `_TASK_COLS` (db.py:224) already exist — reuse.
- Preserve all existing handlers (approve/reject, copy, complete/dismiss) and loading/error/empty states.
- `npx tsc -b` mandatory each task (vitest does not typecheck). Run from `frontend/`.
- Backend tests: `cd backend && python -m pytest`. Frontend: `cd frontend && npx vitest run`.

---

### Task 1: Calendar → DataGrid

**Files:**
- Modify: `frontend/src/views/Calendar.tsx` (full rewrite of the render body; keep queries/mutations)
- Test: `frontend/src/views/Calendar.test.tsx` (create if absent; else extend)

**Interfaces:**
- Consumes: `getEvents(): Promise<EventItem[]>`, `setSignalStatus(table,id,status)` from `@/api`. `EventItem = {id,title,body?,proposed_times?,chosen_time?,attendees?,status}`.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

`frontend/src/views/Calendar.test.tsx` — reuse the render helper other view tests use (check an existing `*.test.tsx`, e.g. `Topics.test.tsx`, for the QueryClient + MemoryRouter wrapper; copy it).

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CalendarView } from './Calendar'
import * as api from '@/api'

vi.mock('@/api', async (orig) => ({ ...(await orig<typeof api>()) }))

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><CalendarView /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.restoreAllMocks())

it('renders events as grid rows', async () => {
  vi.spyOn(api, 'getEvents').mockResolvedValue([
    { id: 1, title: 'Sync', body: 'weekly', chosen_time: '2026-07-12T10:00', status: 'confirmed' },
    { id: 2, title: 'Review', proposed_times: '["9am","10am"]', attendees: '["a","b"]', status: 'suggested' },
  ])
  renderView()
  expect(await screen.findByText('Sync')).toBeInTheDocument()
  expect(screen.getByText('Review')).toBeInTheDocument()
})

it('shows approve/reject only for suggested events', async () => {
  vi.spyOn(api, 'getEvents').mockResolvedValue([
    { id: 2, title: 'Review', status: 'suggested' },
  ])
  renderView()
  await screen.findByText('Review')
  await waitFor(() => expect(screen.getByLabelText('Approve')).toBeInTheDocument())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/Calendar.test.tsx`
Expected: FAIL (grid not present / labels missing).

- [ ] **Step 3: Rewrite Calendar.tsx render body as a DataGrid**

Keep imports for queries/mutations/`parseJsonSafe`. Add DataGrid imports. Replace the events-list JSX (current lines ~110–214) with a DataGrid. Full file:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Typography, Chip, Tooltip, Skeleton } from '@mui/material'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'
import { Check, X } from 'lucide-react'
import { getEvents, setSignalStatus, type EventItem } from '@/api'
import { toast } from 'sonner'

export function CalendarView() {
  const queryClient = useQueryClient()
  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['events'], queryFn: getEvents, refetchInterval: 15000,
  })
  const approveMutation = useMutation({
    mutationFn: (id: number) => setSignalStatus('events', id, 'approved'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['events'] }); toast.success('Approved') },
    onError: () => toast.error('Failed to approve'),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: number) => setSignalStatus('events', id, 'rejected'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['events'] }); toast.success('Rejected') },
    onError: () => toast.error('Failed to reject'),
  })

  const parseJsonSafe = <T,>(json: string | undefined): T[] => {
    if (!json) return []
    try { return JSON.parse(json) } catch { return [] }
  }

  const detailTip = (e: EventItem) => {
    const times = parseJsonSafe<string>(e.proposed_times)
    const attendees = parseJsonSafe<string>(e.attendees)
    const lines: string[] = []
    if (e.body) lines.push(e.body)
    if (!e.chosen_time && times.length) lines.push('Proposed: ' + times.slice(0, 3).join(', ') + (times.length > 3 ? ` +${times.length - 3} more` : ''))
    if (attendees.length) lines.push(`${attendees.length} ${attendees.length === 1 ? 'attendee' : 'attendees'}`)
    return lines.join('\n') || 'No details'
  }

  const columns: GridColDef<EventItem>[] = [
    {
      field: 'title', headerName: 'Event', flex: 1,
      renderCell: (p) => (
        <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{detailTip(p.row)}</span>} arrow>
          <span>{p.row.title}</span>
        </Tooltip>
      ),
    },
    {
      field: 'chosen_time', headerName: 'Time', width: 200,
      renderCell: (p) => p.row.chosen_time
        ? <Chip size="small" color="primary" variant="filled" label={p.row.chosen_time} />
        : <Typography variant="caption" color="text.secondary">Unscheduled</Typography>,
    },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <Chip size="small" variant="outlined" label={p.row.status} />,
    },
    {
      field: 'actions', type: 'actions', width: 90,
      getActions: (p) => p.row.status === 'suggested' ? [
        <GridActionsCellItem key="approve" icon={<Check size={16} />} label="Approve"
          onClick={() => approveMutation.mutate(p.row.id)} disabled={approveMutation.isPending} showInMenu={false} />,
        <GridActionsCellItem key="reject" icon={<X size={16} />} label="Reject"
          onClick={() => rejectMutation.mutate(p.row.id)} disabled={rejectMutation.isPending} showInMenu={false} />,
      ] : [],
    },
  ]

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Calendar</Typography>
        {error && (
          <Box sx={{ bgcolor: 'error.main', opacity: 0.3, border: '1px solid', borderColor: 'error.main', borderRadius: 1, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'error.main' }}>Error loading events</Typography>
            <Button size="small" onClick={() => refetch()} sx={{ color: 'error.main', textDecoration: 'underline' }}>Retry</Button>
          </Box>
        )}
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Skeleton variant="rounded" height={40} /><Skeleton variant="rounded" height={40} /><Skeleton variant="rounded" height={40} />
          </Box>
        ) : events.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No events scheduled.</Typography>
        ) : (
          <DataGrid rows={events} columns={columns} loading={isLoading} density="compact"
            disableColumnMenu pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} sx={{ border: 0 }} />
        )}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run tests + tsc**

Run: `cd frontend && npx vitest run src/views/Calendar.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Calendar.tsx frontend/src/views/Calendar.test.tsx
git commit -m "feat(calendar): migrate event cards to MUI X DataGrid with hover-detail"
```

---

### Task 2: Docs → DataGrid

**Files:**
- Modify: `frontend/src/views/Docs.tsx`
- Test: `frontend/src/views/Docs.test.tsx` (create/extend)

**Interfaces:**
- Consumes: `getSkills(): Promise<Skill[]>`. `Skill = {name,description,schedule?,body}`. No numeric id.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocsView } from './Docs'
import * as api from '@/api'

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><DocsView /></QueryClientProvider>)
}
beforeEach(() => vi.restoreAllMocks())

it('renders skills as grid rows with copy action', async () => {
  vi.spyOn(api, 'getSkills').mockResolvedValue([
    { name: 'daily-brief', description: 'Morning summary', schedule: '0 7 * * *', body: 'BODY' },
  ])
  renderView()
  expect(await screen.findByText('daily-brief')).toBeInTheDocument()
  expect(screen.getByLabelText('Copy daily-brief to clipboard')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/Docs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite Docs.tsx skills grid as DataGrid**

Keep header + quickstart blurb + loading/error/empty states. Replace the skills grid (current lines ~85–142) with a DataGrid. Full file:

```tsx
import { useQuery } from '@tanstack/react-query'
import { getSkills, type Skill } from '@/api'
import { Copy, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Box, Typography, Paper, CircularProgress, useTheme, Button, Tooltip } from '@mui/material'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'

export function DocsView() {
  const theme = useTheme()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['skills'], queryFn: getSkills })

  const copySkill = (name: string, body: string) => {
    navigator.clipboard.writeText(body)
    toast.success(`Copied ${name}`)
  }

  const columns: GridColDef<Skill>[] = [
    { field: 'name', headerName: 'Skill', width: 220,
      renderCell: (p) => <Typography variant="body2" sx={{ fontFamily: 'display', fontWeight: 500 }}>{p.row.name}</Typography> },
    { field: 'description', headerName: 'Description', flex: 1,
      renderCell: (p) => <Tooltip title={p.row.description || 'No description'} arrow><span>{p.row.description}</span></Tooltip> },
    { field: 'schedule', headerName: 'Schedule', width: 160,
      renderCell: (p) => p.row.schedule
        ? <Box component="span" sx={{ px: 1, py: 0.5, bgcolor: 'action.hover', border: `1px solid ${theme.palette.divider}`, borderRadius: 0.5, fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>{p.row.schedule}</Box>
        : <Typography variant="caption" color="text.secondary">—</Typography> },
    { field: 'actions', type: 'actions', width: 70,
      getActions: (p) => [
        <GridActionsCellItem key="copy" icon={<Copy size={16} />} label={`Copy ${p.row.name} to clipboard`}
          onClick={() => copySkill(p.row.name, p.row.body)} showInMenu={false} />,
      ] },
  ]

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      <Box sx={{ height: 64, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', px: 6 }}>
        <Typography variant="h6" sx={{ fontFamily: 'display', fontWeight: 500 }}>Skills Library</Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 6, py: 6 }}>
        <Box sx={{ mb: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Paste these automations into Microsoft Scout to install them.
            </Typography>
          </Paper>
        </Box>
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 12 }}><CircularProgress size={24} /></Box>
        )}
        {error && !isLoading && (
          <Box sx={{ display: 'flex', gap: 1.5, p: 2, alignItems: 'flex-start' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Failed to load skills</Typography>
              <Button variant="outlined" size="small" onClick={() => refetch()} sx={{ textDecoration: 'underline', textTransform: 'none', mt: 0.5 }}>Try again</Button>
            </Box>
          </Box>
        )}
        {!isLoading && !error && (!data || data.length === 0) && (
          <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', py: 12 }}>
            No skills yet. Create one to get started.
          </Typography>
        )}
        {data && data.length > 0 && (
          <DataGrid rows={data} columns={columns} getRowId={(r) => r.name} density="compact"
            disableColumnMenu pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} sx={{ border: 0 }} />
        )}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run tests + tsc**

Run: `cd frontend && npx vitest run src/views/Docs.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Docs.tsx frontend/src/views/Docs.test.tsx
git commit -m "feat(docs): migrate skill cards to MUI X DataGrid (getRowId=name)"
```

---

### Task 3: Tasks edit modal + PATCH endpoint

**Files:**
- Modify: `backend/ea/db.py` (add `update_task`)
- Modify: `backend/web/app.py` (add `TaskPatch` + `PATCH /api/tasks/{task_id}`)
- Test: `backend/tests/test_web_tasks.py` (create)
- Modify: `frontend/src/api.ts` (add `updateTask`)
- Modify: `frontend/src/views/Tasks.tsx` (edit Dialog + edit action)
- Test: `frontend/src/views/Tasks.test.tsx` (create/extend)

**Interfaces:**
- Consumes: `db.update_topic` pattern (db.py:335), `TopicPatch` (app.py:74), `update_topic_endpoint` (app.py:272), `patchJson` (api.ts:142), `_TASK_COLS` (db.py:224).
- Produces: `db.update_task(conn, task_id, **fields) -> int`; `PATCH /api/tasks/{id}` → `{updated:int}`; `updateTask(id, Partial<Task>) -> Promise<{updated:number}>`.

- [ ] **Step 1: Write the failing backend test**

`backend/tests/test_web_tasks.py` — mirror `test_web_people_topics.py` setup (read it for the `_client`/db-seed helper).

```python
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app  # match the factory name used in test_web_app.py


def _app(tmp_path):
    dbp = tmp_path / "t.db"
    db.init_db(db.get_conn(str(dbp)))  # match existing tests' init call
    return create_app(str(dbp)), str(dbp)


def test_patch_task_updates_fields(tmp_path):
    app, dbp = _app(tmp_path)
    conn = db.get_conn(dbp)
    tid = db.add_task(conn, title="old", priority=3, status="open")
    c = TestClient(app)
    r = c.patch(f"/api/tasks/{tid}", json={"title": "new", "priority": 1})
    assert r.status_code == 200 and r.json() == {"updated": 1}
    row = db.get_conn(dbp).execute("SELECT title, priority FROM tasks WHERE id=?", (tid,)).fetchone()
    assert row["title"] == "new" and row["priority"] == 1


def test_patch_missing_task_404(tmp_path):
    app, _ = _app(tmp_path)
    r = TestClient(app).patch("/api/tasks/9999", json={"title": "x"})
    assert r.status_code == 404


def test_patch_empty_body_noop(tmp_path):
    app, dbp = _app(tmp_path)
    tid = db.add_task(db.get_conn(dbp), title="t", priority=3, status="open")
    r = TestClient(app).patch(f"/api/tasks/{tid}", json={})
    assert r.status_code == 200 and r.json() == {"updated": 0}
```

Note: adjust `create_app` / `db.init_db` / `_client` names to whatever `backend/tests/test_web_app.py` and `test_web_people_topics.py` actually use — READ them first and match exactly.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_tasks.py -v`
Expected: FAIL (404 route missing → all fail).

- [ ] **Step 3: Add `update_task` to db.py**

After `add_task` (db.py ~line 239), mirroring `update_topic`:

```python
def update_task(conn: sqlite3.Connection, task_id: int, **fields) -> int:
    """Update a task row. Returns rows affected. Columns validated against _TASK_COLS."""
    bad = set(fields) - _TASK_COLS
    if bad:
        raise ValueError(f"unknown task columns: {bad}")
    if not fields:
        return 0
    sets = ", ".join(f"{k}=?" for k in fields)
    cur = conn.execute(f"UPDATE tasks SET {sets} WHERE id=?", [*fields.values(), task_id])
    conn.commit()
    return cur.rowcount
```

- [ ] **Step 4: Add TaskPatch model + PATCH endpoint to app.py**

Add model after `TopicPatch` (app.py:78):

```python
class TaskPatch(BaseModel):
    title: str | None = None
    detail: str | None = None
    due_at: str | None = None
    priority: int | None = None
    status: str | None = None
```

Add endpoint after `list_tasks` (app.py:120), mirroring `update_topic_endpoint`:

```python
    @app.patch("/api/tasks/{task_id}")
    def update_task_endpoint(task_id: int, body: TaskPatch, conn=Depends(get_db)):
        fields = body.model_dump(exclude_none=True)
        if not fields:
            return {"updated": 0}
        try:
            n = db.update_task(conn, task_id, **fields)
        except sqlite3.Error:
            raise HTTPException(status_code=400, detail="update failed")
        if n == 0:
            raise HTTPException(status_code=404, detail="task not found")
        return {"updated": n}
```

- [ ] **Step 5: Run backend test to verify it passes**

Run: `cd backend && python -m pytest tests/test_web_tasks.py -v`
Expected: PASS (3/3).

- [ ] **Step 6: Add `updateTask` to api.ts**

After `getTasks` (api.ts:173):

```ts
export const updateTask = (id: number, body: Partial<Task>) =>
  patchJson<{ updated: number }>(`/api/tasks/${id}`, body)
```

- [ ] **Step 7: Write failing frontend test for the edit dialog**

`frontend/src/views/Tasks.test.tsx` (extend if it exists):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TasksView } from './Tasks'
import * as api from '@/api'

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter><TasksView /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => vi.restoreAllMocks())

it('opens edit dialog and submits update', async () => {
  vi.spyOn(api, 'getTasks').mockResolvedValue([
    { id: 5, title: 'Draft', detail: 'x', priority: 3, status: 'open' },
  ])
  const upd = vi.spyOn(api, 'updateTask').mockResolvedValue({ updated: 1 })
  renderView()
  await screen.findByText('Draft')
  await userEvent.click(screen.getByLabelText('Edit'))
  const title = await screen.findByLabelText(/Title/i)
  await userEvent.clear(title); await userEvent.type(title, 'Draft 2')
  await userEvent.click(screen.getByRole('button', { name: /Save/i }))
  await waitFor(() => expect(upd).toHaveBeenCalledWith(5, expect.objectContaining({ title: 'Draft 2' })))
})
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/Tasks.test.tsx`
Expected: FAIL (no Edit action / dialog).

- [ ] **Step 9: Add edit dialog + edit action to Tasks.tsx**

Add imports: `Edit2` from `lucide-react`; `Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button` from `@mui/material`; `updateTask, type Task` from `@/api`.

Add state + handlers inside `TasksView` (after existing mutations):

```tsx
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [fTitle, setFTitle] = useState('')
  const [fDetail, setFDetail] = useState('')
  const [fDue, setFDue] = useState('')       // yyyy-mm-dd
  const [fPriority, setFPriority] = useState(3)
  const [fStatus, setFStatus] = useState('open')

  const updateMutation = useMutation({
    mutationFn: () => updateTask(editingId!, {
      title: fTitle.trim(), detail: fDetail.trim() || undefined,
      due_at: fDue ? new Date(fDue).toISOString() : undefined,
      priority: fPriority, status: fStatus,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task updated'); handleCloseEdit() },
    onError: () => toast.error('Failed to update task'),
  })

  const handleEdit = (t: Task) => {
    setEditingId(t.id); setFTitle(t.title); setFDetail(t.detail ?? '')
    setFDue(t.due_at ? new Date(t.due_at).toISOString().slice(0, 10) : '')
    setFPriority(t.priority); setFStatus(t.status); setEditOpen(true)
  }
  const handleCloseEdit = () => { setEditOpen(false); setEditingId(null) }
```

Add Edit action as the FIRST action in the `actions` column `getActions` array:

```tsx
        <GridActionsCellItem
          key="edit" icon={<Edit2 size={16} />} label="Edit"
          onClick={() => handleEdit(params.row)} showInMenu={false} />,
```

Add the Dialog inside the outer `<Box maxWidth>` (before or after the DataGrid):

```tsx
        <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="xs" fullWidth>
          <DialogTitle>Edit task</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Title" value={fTitle} onChange={(e) => setFTitle(e.target.value)} autoFocus required fullWidth />
            <TextField label="Detail" value={fDetail} onChange={(e) => setFDetail(e.target.value)} multiline rows={2} fullWidth />
            <TextField label="Due" type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Priority" select value={fPriority} onChange={(e) => setFPriority(Number(e.target.value))} required fullWidth slotProps={{ select: { native: true } }}>
              <option value={1}>1 - Critical</option>
              <option value={2}>2 - High</option>
              <option value={3}>3 - Normal</option>
            </TextField>
            <TextField label="Status" select value={fStatus} onChange={(e) => setFStatus(e.target.value)} required fullWidth slotProps={{ select: { native: true } }}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="dismissed">Dismissed</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit}>Cancel</Button>
            <Button variant="contained" disabled={!fTitle.trim()} onClick={() => updateMutation.mutate()}>Save</Button>
          </DialogActions>
        </Dialog>
```

- [ ] **Step 10: Run tests + tsc**

Run: `cd frontend && npx vitest run src/views/Tasks.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 11: Commit**

```bash
git add backend/ea/db.py backend/web/app.py backend/tests/test_web_tasks.py frontend/src/api.ts frontend/src/views/Tasks.tsx frontend/src/views/Tasks.test.tsx
git commit -m "feat(tasks): per-item edit modal + PATCH /api/tasks/{id}"
```

---

### Task 4: /activity view + nav wiring

**Files:**
- Create: `frontend/src/views/Activity.tsx`
- Test: `frontend/src/views/Activity.test.tsx`
- Modify: `frontend/src/App.tsx` (lazy import + route)
- Modify: `frontend/src/components/Sidebar.tsx` (nav item)
- Modify: `frontend/src/widgets/ActivityWidget.tsx` (rows → Link to /activity)

**Interfaces:**
- Consumes: `getActivity(limit): Promise<Activity[]>`. `Activity = {id,skill,ran_at,items_created,status,note?}`.
- Produces: `ActivityView` named export; route `/activity`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ActivityView } from './Activity'
import * as api from '@/api'

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ActivityView /></QueryClientProvider>)
}
beforeEach(() => vi.restoreAllMocks())

it('renders activity rows', async () => {
  vi.spyOn(api, 'getActivity').mockResolvedValue([
    { id: 1, skill: 'daily-brief', ran_at: '2026-07-11T07:00:00Z', items_created: 3, status: 'ok', note: 'fine' },
  ])
  renderView()
  expect(await screen.findByText('daily-brief')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/Activity.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Create Activity.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Box, Typography, Tooltip } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { Check, X } from 'lucide-react'
import { getActivity, type Activity } from '@/api'

export function ActivityView() {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['activity', 'all'], queryFn: () => getActivity(200), refetchInterval: 15000,
  })

  const columns: GridColDef<Activity>[] = [
    { field: 'status', headerName: '', width: 44, sortable: false, filterable: false,
      renderCell: (p) => p.row.status === 'error'
        ? <X size={15} aria-label="error" style={{ color: 'var(--mui-palette-error-main)' }} />
        : <Check size={15} aria-label="ok" style={{ color: 'var(--mui-palette-success-main)' }} /> },
    { field: 'skill', headerName: 'Skill', flex: 1,
      renderCell: (p) => <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{p.row.skill}</Typography> },
    { field: 'items_created', headerName: 'Items', width: 90, type: 'number' },
    { field: 'ran_at', headerName: 'Ran', width: 180,
      renderCell: (p) => <Typography variant="caption" color="text.secondary">{new Date(p.row.ran_at).toLocaleString()}</Typography> },
    { field: 'note', headerName: 'Note', flex: 1,
      renderCell: (p) => p.row.note
        ? <Tooltip title={p.row.note} arrow><span>{p.row.note}</span></Tooltip>
        : <Typography variant="caption" color="text.secondary">—</Typography> },
  ]

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Activity</Typography>
        {error && <Typography variant="body2" sx={{ color: 'error.main' }}>Error loading activity</Typography>}
        {!isLoading && rows.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No skill runs yet.</Typography>
        ) : (
          <DataGrid rows={rows} columns={columns} loading={isLoading} density="compact"
            disableColumnMenu pageSizeOptions={[25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'ran_at', sort: 'desc' }] },
            }} sx={{ border: 0 }} />
        )}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Wire route in App.tsx**

Add lazy import beside the others (after Topics, line ~22):

```tsx
const ActivityView = lazy(() => import('@/views/Activity').then(m => ({ default: m.ActivityView })))
```

Add route before the catch-all (after `/docs`, line ~99):

```tsx
                    <Route path="/activity" element={<ActivityView />} />
```

- [ ] **Step 5: Add Sidebar nav item**

In `Sidebar.tsx`, add `Activity` to the lucide import line, and a nav entry after `docs` (line ~22):

```tsx
  { id: 'activity', route: '/activity', icon: Activity, label: 'Activity' },
```

- [ ] **Step 6: Make ActivityWidget rows navigate**

In `ActivityWidget.tsx`: import `Link` from `react-router-dom`. Change the row `Box` (line ~38) to a Link:

```tsx
            <Box component={Link} to="/activity" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.25, textDecoration: 'none', color: 'inherit', borderRadius: 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
```

(keep the icon + skill + items children unchanged; keep the wrapping Tooltip).

- [ ] **Step 7: Run tests + tsc + full FE suite**

Run: `cd frontend && npx vitest run && npx tsc -b`
Expected: PASS (new + existing), tsc clean.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views/Activity.tsx frontend/src/views/Activity.test.tsx frontend/src/App.tsx frontend/src/components/Sidebar.tsx frontend/src/widgets/ActivityWidget.tsx
git commit -m "feat(activity): first-class /activity DataGrid view + widget drill-down"
```

---

### Task 5: Verification

**Files:** none (verification only).

- [ ] **Step 1: Full suites + typecheck + build**

Run:
```bash
cd backend && python -m pytest -q
cd ../frontend && npx vitest run && npx tsc -b && npm run build
```
Expected: BE all pass, FE all pass, tsc clean, build succeeds.

- [ ] **Step 2: Live sweep (correct-bundle discipline)**

```bash
docker compose stop web            # stop stale container occupying :8765
# launch run_web via nohup on the fresh build, or serve frontend/dist
```
Verify against the CORRECT bundle: compare served vs built `index-*.js` hash before trusting the page.

Check: `/calendar`, `/docs`, `/tasks`, `/activity` render as DataGrids; task edit round-trips (open modal → change title → Save → grid updates); ActivityWidget row click → `/activity`; sort/filter/tooltip work; 0 pageerrors. Sweep under at least one non-default theme to confirm theming holds.

- [ ] **Step 3: Update ledger + memory**

Mark all tasks complete in `.superpowers/sdd/progress.md`; note commits. Ready for final whole-branch review + merge.
