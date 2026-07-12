# F3 Fold Inbox + Actions into Data Feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inbox (signals) and Actions become sections inside Data Feed with status **filter chips instead of tabs**; the Review view is removed and every reference repointed.

**Architecture:** Extend the feed shell (`FeedView` type + `FeedRail` ITEMS + `DataFeed` renderers) with two new section components. `FeedInboxSection` reuses Inbox's DataGrid but swaps the status Tabs for single-select filter chips over one unified `getSignals()` list, with signal-title click opening the F1 `ResponseDetailModal`. `FeedActionsSection` reuses Actions' grouped rendering. Then Review is deleted and all routes/nav/palette/widget references repointed to `/feed?view=…`.

**Tech Stack:** React 19, MUI 9 + x-data-grid, react-router-dom 7, TanStack Query, Vitest + Testing Library.

## Global Constraints

- Frontend only. No backend/API changes.
- Two separate sections (signals vs actions) — do NOT merge into one stream.
- Reuse existing list UI: `FeedInboxSection` uses the DataGrid columns from `views/Inbox.tsx`; `FeedActionsSection` uses the grouped card rendering from `views/Actions.tsx`.
- Signal detail = the F1 `ResponseDetailModal` (`@/components/quickdraw/ResponseDetailModal`), `kind="signal"`, full row object.
- Status chips are single-select toggles (click active → clears to "all"); "proactive" is an independent toggle. Chip filtering is client-side over the fetched list.
- Preserve deep links: `?status=` and `?type=proactive` preselect chips; legacy routes redirect.
- Final nav (7 items): Home · Tasks · Schedule · Data Feed · People · Automations · Settings. No Review.
- Frontend cmds: `cd frontend`; tests `npx vitest run <file>`; build `npm run build`.

---

### Task 1: Feed shell registers `inbox` + `actions` views

**Files:**
- Modify: `frontend/src/components/feed/types.ts` (line 3)
- Modify: `frontend/src/components/feed/FeedRail.tsx` (imports line 2; ITEMS lines 5-11)
- Test: `frontend/src/components/feed/FeedRail.test.tsx` (create)

**Interfaces:**
- Produces: `FeedView` now includes `'inbox' | 'actions'`; FeedRail renders Inbox + Actions nav entries.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/feed/FeedRail.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeedRail } from './FeedRail'

describe('FeedRail', () => {
  it('lists Inbox and Actions sections', () => {
    render(<FeedRail view="overview" onView={() => {}} />)
    expect(screen.getByRole('button', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument()
  })
  it('calls onView with the section id on click', () => {
    const onView = vi.fn()
    render(<FeedRail view="overview" onView={onView} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inbox' }))
    expect(onView).toHaveBeenCalledWith('inbox')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/feed/FeedRail.test.tsx`
Expected: FAIL — no "Inbox"/"Actions" nav buttons.

- [ ] **Step 3: Implement**

In `frontend/src/components/feed/types.ts` line 3:

```ts
export type FeedView = 'overview' | 'trending' | 'news' | 'learning' | 'topics' | 'inbox' | 'actions'
```

In `frontend/src/components/feed/FeedRail.tsx`, extend the icon import and ITEMS:

```tsx
import { LayoutGrid, TrendingUp, Newspaper, GraduationCap, Hash, Mail, CheckCircle } from 'lucide-react'
```

```tsx
const ITEMS: { id: FeedView; label: string; Icon: typeof Hash }[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutGrid },
  { id: 'inbox', label: 'Inbox', Icon: Mail },
  { id: 'actions', label: 'Actions', Icon: CheckCircle },
  { id: 'trending', label: 'Trending', Icon: TrendingUp },
  { id: 'news', label: 'News', Icon: Newspaper },
  { id: 'learning', label: 'Learning', Icon: GraduationCap },
  { id: 'topics', label: 'Topics', Icon: Hash },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/feed/FeedRail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/types.ts frontend/src/components/feed/FeedRail.tsx frontend/src/components/feed/FeedRail.test.tsx
git commit -m "feat(feed): register Inbox + Actions rail sections"
```

---

### Task 2: `FeedInboxSection` — signals with chip filters + detail modal

**Files:**
- Create: `frontend/src/components/feed/FeedInboxSection.tsx`
- Test: `frontend/src/components/feed/FeedInboxSection.test.tsx`

**Interfaces:**
- Consumes: `getSignals`, `setSignalStatus`, `Signal` (`@/api`); `relativeTime` (`@/widgets/SignalsWidget`); `useFriendlyTime` (`@/lib/timePrefs`); `ActionBadge`, `ActionMenu` (`@/components/actions/*`); `ResponseDetailModal` (`@/components/quickdraw/ResponseDetailModal`).
- Produces: `FeedInboxSection()` (no props; reads `useSearchParams`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/feed/FeedInboxSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedInboxSection } from './FeedInboxSection'
import * as api from '@/api'

const SIGNALS = [
  { id: 1, type: 'email', source: 'inbox', title: 'New one', status: 'new', priority: 1, created_at: '2026-07-12T09:00:00Z', why: 'r1' },
  { id: 2, type: 'proactive', source: 'skill', title: 'Triaged one', status: 'triaged', priority: 3, created_at: '2026-07-12T08:00:00Z', why: 'r2' },
]

function wrap(path = '/feed?view=inbox') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}><FeedInboxSection /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FeedInboxSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getSignals').mockResolvedValue(SIGNALS as never)
  })

  it('shows all statuses by default', async () => {
    wrap()
    expect(await screen.findByText('New one')).toBeInTheDocument()
    expect(screen.getByText('Triaged one')).toBeInTheDocument()
  })

  it('a status chip filters the list', async () => {
    wrap()
    await screen.findByText('New one')
    fireEvent.click(screen.getByRole('button', { name: 'triaged' }))
    expect(screen.queryByText('New one')).toBeNull()
    expect(screen.getByText('Triaged one')).toBeInTheDocument()
  })

  it('preselects the status chip from ?status=', async () => {
    wrap('/feed?view=inbox&status=triaged')
    await screen.findByText('Triaged one')
    expect(screen.queryByText('New one')).toBeNull()
  })

  it('opens ResponseDetailModal when a signal title is clicked', async () => {
    wrap()
    const title = await screen.findByText('New one')
    fireEvent.click(title)
    await waitFor(() => expect(screen.getByText('AI Reasoning')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/feed/FeedInboxSection.test.tsx`
Expected: FAIL — cannot resolve `./FeedInboxSection`.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/feed/FeedInboxSection.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Box, Chip, Typography, Tooltip } from '@mui/material'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'
import { CheckCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getSignals, setSignalStatus, type Signal } from '@/api'
import { relativeTime } from '@/widgets/SignalsWidget'
import { useFriendlyTime } from '@/lib/timePrefs'
import { ActionBadge } from '@/components/actions/ActionBadge'
import { ActionMenu } from '@/components/actions/ActionMenu'
import { ResponseDetailModal } from '@/components/quickdraw/ResponseDetailModal'

const PRIORITY_COLOR: Record<number, string> = { 1: 'error.main', 2: 'warning.main' }
const STATUSES = ['new', 'triaged', 'actioned', 'dismissed'] as const

export function FeedInboxSection() {
  const qc = useQueryClient()
  const friendly = useFriendlyTime()
  const [params] = useSearchParams()
  const [status, setStatus] = useState<string | undefined>(params.get('status') ?? undefined)
  const [proactive, setProactive] = useState(params.get('type') === 'proactive')
  const [detail, setDetail] = useState<Signal | null>(null)

  const { data: signals = [], isLoading } = useQuery({
    queryKey: ['signals'], queryFn: () => getSignals(), refetchInterval: 15000,
  })

  const rows = signals.filter(
    (s) => (!status || s.status === status) && (!proactive || s.type === 'proactive'),
  )

  const setStat = useMutation({
    mutationFn: ({ id, value }: { id: number; value: string }) => setSignalStatus('signals', id, value),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['signals'] }); toast.success(v.value === 'dismissed' ? 'Dismissed' : 'Updated') },
  })

  const columns: GridColDef[] = [
    {
      field: 'priority', headerName: '', width: 36, sortable: false, filterable: false,
      renderCell: (p) => <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_COLOR[p.row.priority] ?? 'info.main' }} aria-label={`priority ${p.row.priority}`} />,
    },
    {
      field: 'title', headerName: 'Signal', flex: 1,
      renderCell: (p) => (
        <Tooltip title={<Box sx={{ p: 0.5 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{p.row.title}</Typography><Typography variant="caption" color="text.secondary">{friendly(p.row.created_at)} · priority {p.row.priority}</Typography></Box>}>
          <Box role="button" tabIndex={0} onClick={() => setDetail(p.row as Signal)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(p.row as Signal) } }}
            sx={{ cursor: 'pointer', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.row.title}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'source', headerName: 'Source', width: 140,
      renderCell: (p) => <Chip size="small" variant="outlined" label={`${p.row.source}${p.row.source_skill ? ` · ${p.row.source_skill}` : ''}`} />,
    },
    {
      field: 'created_at', headerName: 'Created', width: 110,
      renderCell: (p) => <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{relativeTime(p.value)}</Typography>,
    },
    {
      field: 'actions', type: 'actions', width: 120,
      getActions: (p) => [
        <GridActionsCellItem key="badge" icon={<ActionBadge entityType="email" entityId={p.row.id} />} label="Action status" showInMenu={false} disabled />,
        <GridActionsCellItem key="menu" icon={<ActionMenu entity={{ type: 'email', id: p.row.id }} />} label="Actions" showInMenu={false} />,
        <GridActionsCellItem key="dismiss" icon={<Trash2 size={16} />} label="Dismiss" onClick={() => setStat.mutate({ id: p.row.id, value: 'dismissed' })} showInMenu={false} />,
        <GridActionsCellItem key="triage" icon={<CheckCircle size={16} />} label="Triage" onClick={() => setStat.mutate({ id: p.row.id, value: 'triaged' })} showInMenu={false} />,
      ],
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', gap: 0.5, p: 1, flexShrink: 0, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <Chip key={s} label={s} size="small" variant={status === s ? 'filled' : 'outlined'}
            onClick={() => setStatus(status === s ? undefined : s)} />
        ))}
        <Chip label="proactive" size="small" color="secondary" variant={proactive ? 'filled' : 'outlined'}
          onClick={() => setProactive((v) => !v)} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 0.5 }}>
        {!isLoading && rows.length === 0
          ? <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>Inbox is clear.</Typography>
          : <DataGrid rows={rows} columns={columns} loading={isLoading} disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              sx={{ border: 'none' }} />}
      </Box>
      <ResponseDetailModal open={!!detail} kind="signal" item={detail} onClose={() => setDetail(null)}
        onStatus={(value) => { if (detail) { setStat.mutate({ id: detail.id, value }); setDetail(null) } }} />
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/feed/FeedInboxSection.test.tsx`
Expected: PASS (4 tests). Note: `within` is imported for potential scoping; if unused, remove it to satisfy lint.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/FeedInboxSection.tsx frontend/src/components/feed/FeedInboxSection.test.tsx
git commit -m "feat(feed): FeedInboxSection — signals with chip filters + detail modal"
```

---

### Task 3: `FeedActionsSection` — actions grouped list

**Files:**
- Create: `frontend/src/components/feed/FeedActionsSection.tsx`
- Test: `frontend/src/components/feed/FeedActionsSection.test.tsx`

**Interfaces:**
- Consumes: `listActions`, `approveAction`, `dismissAction`, `Action` (`@/api`); `safeHttpUrl` (`@/lib/url`).
- Produces: `FeedActionsSection()` (no props).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/feed/FeedActionsSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedActionsSection } from './FeedActionsSection'
import * as api from '@/api'

const ACTIONS = [
  { id: 1, action_type: 'email_new', mode: 'review', status: 'drafted', created_at: '2026-07-12T09:00:00Z', rationale: 'Send recap' },
  { id: 2, action_type: 'teams_post', mode: 'auto', status: 'completed', created_at: '2026-07-12T08:00:00Z' },
]

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><FeedActionsSection /></QueryClientProvider>)
}

describe('FeedActionsSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'listActions').mockResolvedValue(ACTIONS as never)
  })

  it('renders pending and recent groups', async () => {
    wrap()
    expect(await screen.findByText(/Pending review/)).toBeInTheDocument()
    expect(screen.getByText(/Recent results/)).toBeInTheDocument()
    expect(screen.getByText('Send recap')).toBeInTheDocument()
  })

  it('approves a pending action', async () => {
    const spy = vi.spyOn(api, 'approveAction').mockResolvedValue({ updated: 1 } as never)
    wrap()
    await screen.findByText('Send recap')
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith(1))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/feed/FeedActionsSection.test.tsx`
Expected: FAIL — cannot resolve `./FeedActionsSection`.

- [ ] **Step 3: Implement** (moves `views/Actions.tsx` body into a feed section; container fills the section, no page `h5`)

```tsx
// frontend/src/components/feed/FeedActionsSection.tsx
import { Box, Typography, Button, Stack, Chip, Link } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listActions, approveAction, dismissAction, type Action } from '@/api'
import { safeHttpUrl } from '@/lib/url'

const preview = (a: Action) =>
  a.rationale || (a.payload?.subject as string) || (a.payload?.message as string) || a.action_type

export function FeedActionsSection() {
  const qc = useQueryClient()
  const { data: actions = [] } = useQuery({ queryKey: ['actions'], queryFn: () => listActions(), refetchInterval: 10000 })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['actions'] })
  const go = useMutation({ mutationFn: approveAction, onSuccess: () => { toast.success('Approved'); invalidate() } })
  const drop = useMutation({ mutationFn: dismissAction, onSuccess: () => { toast('Dismissed'); invalidate() } })

  const pending = actions.filter((a) => a.status === 'drafted' && a.mode === 'review')
  const running = actions.filter((a) => a.status === 'executing')
  const recent = actions.filter((a) => a.status === 'completed' || a.status === 'failed').slice(0, 20)

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <section>
        <Typography variant="subtitle2" gutterBottom>Pending review ({pending.length})</Typography>
        <Stack spacing={1}>
          {pending.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <Chip size="small" label={a.action_type} />
              <Typography sx={{ flex: 1 }}>{preview(a)}</Typography>
              <Button size="small" variant="contained" onClick={() => go.mutate(a.id)}>Go</Button>
              <Button size="small" onClick={() => drop.mutate(a.id)}>Dismiss</Button>
            </Box>
          ))}
          {pending.length === 0 && <Typography variant="caption" color="text.secondary">Nothing waiting.</Typography>}
        </Stack>
      </section>
      <section>
        <Typography variant="subtitle2" gutterBottom>Running ({running.length})</Typography>
        <Stack spacing={1}>
          {running.map((a) => <Typography key={a.id} variant="body2">⏳ {a.action_type} — {preview(a)}</Typography>)}
          {running.length === 0 && <Typography variant="caption" color="text.secondary">Nothing running.</Typography>}
        </Stack>
      </section>
      <section>
        <Typography variant="subtitle2" gutterBottom>Recent results</Typography>
        <Stack spacing={1}>
          {recent.map((a) => (
            <Typography key={a.id} variant="body2" color={a.status === 'failed' ? 'error' : 'text.primary'}>
              {a.status === 'failed' ? '✗' : '✓'} {a.action_type} — {preview(a)}{' '}
              {safeHttpUrl(a.result?.access_url) ? (
                <Link href={safeHttpUrl(a.result?.access_url)!} target="_blank" rel="noopener noreferrer">Open</Link>
              ) : null}
            </Typography>
          ))}
          {recent.length === 0 && <Typography variant="caption" color="text.secondary">No recent results.</Typography>}
        </Stack>
      </section>
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/feed/FeedActionsSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/FeedActionsSection.tsx frontend/src/components/feed/FeedActionsSection.test.tsx
git commit -m "feat(feed): FeedActionsSection — actions grouped list"
```

---

### Task 4: Wire both sections into `DataFeed.tsx`

**Files:**
- Modify: `frontend/src/views/DataFeed.tsx`
- Test: `frontend/src/views/DataFeed.test.tsx` (extend existing)

**Interfaces:**
- Consumes: `FeedInboxSection` (Task 2), `FeedActionsSection` (Task 3).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/views/DataFeed.test.tsx` (inside its top `describe`). First check the file's existing render helper; reuse it. If it renders `<DataFeedView/>` under a router + QueryClient, add:

```tsx
it('renders the Inbox section when view=inbox', async () => {
  vi.spyOn(api, 'getSignals').mockResolvedValue([
    { id: 1, type: 'email', source: 'inbox', title: 'A signal', status: 'new', priority: 1, created_at: '2026-07-12T09:00:00Z' },
  ] as never)
  renderAt('/feed?view=inbox')   // use the file's existing helper name
  expect(await screen.findByText('A signal')).toBeInTheDocument()
})
```

(If the existing test file lacks `api`/`renderAt`, mirror its actual imports and helper. Ensure `getSignals` is mocked so the grid has rows.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/DataFeed.test.tsx`
Expected: FAIL — inbox view renders nothing (no case yet).

- [ ] **Step 3: Implement**

In `frontend/src/views/DataFeed.tsx`:

Add imports:

```tsx
import { FeedInboxSection } from '@/components/feed/FeedInboxSection'
import { FeedActionsSection } from '@/components/feed/FeedActionsSection'
```

Extend the `VIEWS` array:

```tsx
const VIEWS: FeedView[] = ['overview', 'inbox', 'actions', 'trending', 'news', 'learning', 'topics']
```

Add the two renderers alongside the existing `{view === ...}` blocks (before `<FeedDetail .../>`):

```tsx
{view === 'inbox' && <FeedInboxSection />}
{view === 'actions' && <FeedActionsSection />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/views/DataFeed.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/DataFeed.tsx frontend/src/views/DataFeed.test.tsx
git commit -m "feat(feed): render Inbox + Actions sections in DataFeed"
```

---

### Task 5: Remove Review; repoint every reference; delete old views

**Files:**
- Modify: `frontend/src/nav.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/CommandPalette.tsx`
- Modify: `frontend/src/components/quickdraw/Quickdraw.tsx`
- Modify: `frontend/src/components/actions/ActionBadge.tsx`
- Modify: `frontend/src/widgets/SignalsWidget.tsx`
- Modify: `frontend/src/widgets/registry.ts`
- Modify: `frontend/src/widgets/KpiStrip.tsx`
- Delete: `frontend/src/views/Review.tsx`, `frontend/src/views/Inbox.tsx`, `frontend/src/views/Actions.tsx` (+ their test files if present)
- Modify tests: `frontend/src/App.routes.test.tsx`, `frontend/src/views/containers.test.tsx`, `frontend/src/components/Sidebar.test.tsx`, `frontend/src/components/CommandPalette.test.tsx`

**Interfaces:**
- Consumes: the `/feed?view=inbox|actions` routes (Task 4).

- [ ] **Step 1: Inventory current references (record actual line numbers)**

Run:
```bash
cd frontend && grep -rn "/review\|/inbox\|/actions\|ReviewView\|InboxView\|ActionsView\|'review'" src --include=*.tsx --include=*.ts | grep -v ".test."
```
Expected: references in nav.ts, App.tsx, CommandPalette.tsx, Quickdraw.tsx, ActionBadge.tsx, SignalsWidget.tsx, registry.ts, KpiStrip.tsx, Review.tsx. Use this list to drive the edits below.

- [ ] **Step 2: Update the route test first (failing)**

Replace the redirect assertions in `frontend/src/App.routes.test.tsx` `describe('routing', …)`:

```tsx
it('redirects legacy /inbox to the feed inbox section', async () => {
  renderAt('/inbox')
  const link = await screen.findByRole('link', { name: /data feed/i })
  await waitFor(() => expect(link).toHaveAttribute('aria-current', 'page'))
})

it('redirects legacy /actions to the feed actions section', async () => {
  renderAt('/actions')
  const link = await screen.findByRole('link', { name: /data feed/i })
  await waitFor(() => expect(link).toHaveAttribute('aria-current', 'page'))
})

it('has no Review nav link', async () => {
  renderAt('/')
  await screen.findByRole('link', { name: /data feed/i })
  expect(screen.queryByRole('link', { name: /^review$/i })).toBeNull()
})
```

(Delete the old `/inbox`→`/review` and `/deadlines`→`/schedule` stays as-is; keep the schedule test unchanged.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.routes.test.tsx`
Expected: FAIL — Review link still present / redirects go to `/review`.

- [ ] **Step 4: Edit `nav.ts`** — remove the `review` item:

```ts
export const NAV: NavItem[] = [
  { id: 'home', path: '/', label: 'Home', icon: Grid3x3, group: 'work' },
  { id: 'tasks', path: '/tasks', label: 'Tasks', icon: CheckSquare, group: 'work' },
  { id: 'schedule', path: '/schedule', label: 'Schedule', icon: Calendar, group: 'work' },
  { id: 'feed', path: '/feed', label: 'Data Feed', icon: Newspaper, group: 'knowledge' },
  { id: 'people', path: '/people', label: 'People', icon: Users, group: 'knowledge' },
  { id: 'automations', path: '/automations', label: 'Automations', icon: Zap, group: 'system' },
  { id: 'settings', path: '/settings', label: 'Settings', icon: Cog, group: 'system' },
]
```

Remove the now-unused `Inbox` icon import from `nav.ts` (it was only used by the review item).

- [ ] **Step 5: Edit `App.tsx`** — drop the Review route/import; repoint redirects:

Remove `const ReviewView = lazy(...)`. Remove `<Route path="/review" element={<ReviewView />} />`. Change the legacy redirects:

```tsx
<Route path="/review" element={<Navigate to="/feed?view=inbox" replace />} />
<Route path="/inbox" element={<Navigate to="/feed?view=inbox" replace />} />
<Route path="/actions" element={<Navigate to="/feed?view=actions" replace />} />
```

- [ ] **Step 6: Repoint the remaining references**

- `frontend/src/components/CommandPalette.tsx`:
  - `KIND_VIEW.signal`: change `'/review'` → `'/feed?view=inbox'`.
  - Quick action: change `value="go-to-review"` item to label "Go to Inbox" and `onViewChange('/feed?view=inbox')`.
- `frontend/src/components/quickdraw/Quickdraw.tsx`: the "Review in Actions" button `navigate('/actions')` → `navigate('/feed?view=actions')`.
- `frontend/src/components/actions/ActionBadge.tsx`: `navigate('/actions')` → `navigate('/feed?view=actions')`.
- `frontend/src/widgets/SignalsWidget.tsx`: `navigate('/inbox?status=new')` → `navigate('/feed?view=inbox&status=new')`.
- `frontend/src/widgets/registry.ts`: signals widget `drillDown: '/inbox?status=new'` → `'/feed?view=inbox&status=new'`.
- `frontend/src/widgets/KpiStrip.tsx`: `to: '/inbox?type=proactive'` → `'/feed?view=inbox&type=proactive'`; `to: '/inbox?status=new'` → `'/feed?view=inbox&status=new'`.

- [ ] **Step 7: Delete the old views + their tests**

```bash
cd frontend
git rm src/views/Review.tsx src/views/Inbox.tsx src/views/Actions.tsx
git rm -f src/views/Inbox.test.tsx src/views/Inbox.actions.test.tsx src/views/Actions.test.tsx 2>/dev/null || true
```

Update `frontend/src/views/containers.test.tsx`: remove the `ReviewView` import + its `it(...)` case and the `./Inbox`/`./Actions` `vi.mock` lines that only served Review; keep the Schedule + Automations cases. Update `frontend/src/components/Sidebar.test.tsx`: change the "8 registry labels" expectation to 7 and drop any `Review` assertion; ensure it still asserts a group header (e.g. `Knowledge`). Update `frontend/src/components/CommandPalette.test.tsx`: the "navigates to a registry path" and nav-label tests must not reference `Review`; use `Data Feed`/another current label, and update the quick-action assertion to "Go to Inbox".

- [ ] **Step 8: Grep for dangling references**

Run:
```bash
cd frontend && grep -rn "ReviewView\|/review\|views/Inbox\|views/Actions\|'/inbox'\|'/actions'\|InboxView\|ActionsView" src
```
Expected: ONLY the intentional redirect `Navigate to="/feed?view=inbox|actions"` targets and the redirect route paths (`path="/inbox"`, `path="/actions"`, `path="/review"`) remain. No component imports of the deleted views.

- [ ] **Step 9: Full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all green; build succeeds (proves no dangling imports of deleted files).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(feed): remove Review, repoint refs to /feed?view=; delete Inbox/Actions/Review views

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** FeedView + rail entries (Task 1 ✓); FeedInboxSection with chips-not-tabs, unified list, proactive toggle, `?status`/`?type` preselect, DataGrid reuse, title→ResponseDetailModal (Task 2 ✓); FeedActionsSection grouped reuse (Task 3 ✓); DataFeed wiring + `?view=` (Task 4 ✓); Review removal, nav→7, redirects `/inbox|/actions|/review`→`/feed?view=…`, all 8 reference sites repointed, old views deleted, tests updated, deep links preserved (Task 5 ✓); frontend-only (Global Constraints ✓).
- **Placeholder scan:** none — concrete code/commands throughout. Task 4/5 test edits reference the existing test files' real helpers with an explicit instruction to mirror them (their exact bodies vary; the implementer inventories them in Task 5 Step 1 and Task 4 Step 1).
- **Type consistency:** `FeedView` union extended once (Task 1), consumed by FeedRail/DataFeed; `setStat.mutate({ id, value })` signature consistent across row actions and modal `onStatus`; `ResponseDetailModal` props (`open/kind/item/onClose/onStatus`) match its F1 definition; `Signal` row type used for `setDetail`.
- **Sequencing note:** Task 5's redirect tests depend on the feed sections (Tasks 2-4) existing so the `/feed?view=…` targets render — correct ordering (5 is last).
- **Watch-item:** `FeedInboxSection` fetches all signals via `getSignals()` (all statuses incl dismissed) for client-side chip filtering. Fine for a single-user app; if the dismissed set grows large, add server-side paging later. (`// ponytail: client-filter all signals; server-page if the dismissed set grows`.)
