# Phase 2 — Widget-Registry Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Dashboard with a widget-registry system: 6 MUI X-powered widgets with hover quick-peeks, drill-down deep links, per-widget error isolation, and a user-editable layout — where adding a future data source = one widget file + one registry line.

**Architecture:** Pure layout module (localStorage `ea-dashboard-layout`) + declarative registry (`WIDGETS: WidgetDef[]`) + shared `WidgetCard` chrome (title, live count chip via context, hover toolbar: refresh/expand/open/hide, error boundary, skeleton). Dashboard renders a 12-col CSS grid from the layout. Widgets consume existing TanStack Query hooks over `api.ts` (unchanged). Drill-downs navigate to existing routes with query params; the 4 params widgets actually emit get parsed by their target views in this phase.

**Tech Stack:** MUI v7 (installed), MUI X Charts + DataGrid v8 Community (`@mui/x-charts`, `@mui/x-data-grid`), react-router (installed), TanStack Query (installed), vitest.

## Global Constraints

- MUI X **Community/MIT only** — never import from `-pro` packages.
- localStorage contracts: `ea-theme`, `ea-accent` (existing), **`ea-dashboard-layout`** (new, this plan).
- Extensibility contract: a new data source requires exactly (1) one new widget component file in `frontend/src/widgets/`, (2) one entry appended to `WIDGETS` in `registry.ts`. Nothing else.
- Files under 500 lines. Semantic commits.
- After every task: `cd frontend && npx vitest run` green. Before final: `npm run build` + `npx tsc -b` green, backend suite untouched/green.
- Dataviz rules (validated 2026-07-09): chart marks use the app accent via CSS var `var(--color-accent)` (single-hue; tracks user accent personalization). Light-mode accent is 2.85:1 vs white → **every BarChart must set `barLabel="value"`** (direct labels = sanctioned contrast relief). Status colors (ok/warn/crit/info) reserved for status semantics only, never as series colors. Axis/legend/label text uses text tokens (`text.secondary`), never the series color. Tooltips stay enabled (MUI X default). One axis per chart; bar corner radius 4.
- Sparklines only where real history is derivable from existing data (signals/day from `created_at`; items per run from activity). Never fabricate trend data for tiles that have no history.
- Existing routes (Phase 1): `/`, `/inbox`, `/tasks`, `/calendar`, `/trending`, `/deadlines`, `/people`, `/topics`, `/docs`, `/settings`.
- `api.ts` types in use: `Deadline{id,title,due_at,countdown_seconds,...}`, `Trend{id,term,score,delta?,...}`, `Signal{id,type,title,status,priority,created_at,...}`, `Task{id,title,due_at?,priority,status}`, `Activity{id,skill,ran_at,items_created,status}`, `EventItem{id,title,chosen_time?,status,...}`, `OutlookResponse{deadlines,top_trends,proactive,tasks_due_today}`. Fetchers: `getOutlook()`, `getDeadlines()`, `getTrends()`, `getSignals(status?)`, `getActivity(limit)`, `getTasks()`, `getEvents()`.

---

### Task 1: MUI X deps + layout module

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/src/widgets/layout.ts`
- Test: `frontend/src/widgets/layout.test.ts`

**Interfaces:**
- Produces: `DashboardLayout { order: string[]; hidden: string[] }`, `defaultLayout(allKeys: string[]): DashboardLayout`, `loadLayout(allKeys: string[]): DashboardLayout`, `saveLayout(layout: DashboardLayout): void`, `moveWidget(layout, key, dir: -1 | 1): DashboardLayout`, `setWidgetHidden(layout, key, hidden: boolean): DashboardLayout`, `LAYOUT_KEY = 'ea-dashboard-layout'`. All pure except load/save (localStorage).

- [ ] **Step 1: Install deps**

```bash
cd frontend && npm install @mui/x-charts @mui/x-data-grid
```

Expected: installs v8-line packages compatible with @mui/material v7.

- [ ] **Step 2: Write failing tests**

Create `frontend/src/widgets/layout.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  defaultLayout, loadLayout, saveLayout, moveWidget, setWidgetHidden, LAYOUT_KEY,
} from './layout'

const KEYS = ['a', 'b', 'c']

describe('dashboard layout', () => {
  beforeEach(() => localStorage.clear())

  it('defaultLayout shows all keys in registry order', () => {
    expect(defaultLayout(KEYS)).toEqual({ order: ['a', 'b', 'c'], hidden: [] })
  })

  it('loadLayout returns default when nothing stored', () => {
    expect(loadLayout(KEYS)).toEqual(defaultLayout(KEYS))
  })

  it('round-trips through localStorage', () => {
    saveLayout({ order: ['c', 'a', 'b'], hidden: ['b'] })
    expect(loadLayout(KEYS)).toEqual({ order: ['c', 'a', 'b'], hidden: ['b'] })
  })

  it('drops unknown keys and appends new registry keys on load', () => {
    saveLayout({ order: ['zombie', 'b', 'a'], hidden: ['zombie', 'c'] })
    expect(loadLayout(KEYS)).toEqual({ order: ['b', 'a', 'c'], hidden: ['c'] })
  })

  it('ignores corrupt stored JSON', () => {
    localStorage.setItem(LAYOUT_KEY, '{not json')
    expect(loadLayout(KEYS)).toEqual(defaultLayout(KEYS))
  })

  it('moveWidget swaps within bounds and clamps at edges', () => {
    const l = defaultLayout(KEYS)
    expect(moveWidget(l, 'b', -1).order).toEqual(['b', 'a', 'c'])
    expect(moveWidget(l, 'a', -1).order).toEqual(['a', 'b', 'c'])
    expect(moveWidget(l, 'c', 1).order).toEqual(['a', 'b', 'c'])
  })

  it('setWidgetHidden adds/removes without duplicates', () => {
    const l = defaultLayout(KEYS)
    const h = setWidgetHidden(setWidgetHidden(l, 'b', true), 'b', true)
    expect(h.hidden).toEqual(['b'])
    expect(setWidgetHidden(h, 'b', false).hidden).toEqual([])
  })
})
```

- [ ] **Step 3: Run to verify fail**

Run: `cd frontend && npx vitest run src/widgets/layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement layout.ts**

```ts
export const LAYOUT_KEY = 'ea-dashboard-layout'

export interface DashboardLayout {
  order: string[]
  hidden: string[]
}

export function defaultLayout(allKeys: string[]): DashboardLayout {
  return { order: [...allKeys], hidden: [] }
}

export function loadLayout(allKeys: string[]): DashboardLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return defaultLayout(allKeys)
    const parsed = JSON.parse(raw) as DashboardLayout
    const known = new Set(allKeys)
    const order = parsed.order.filter((k) => known.has(k))
    for (const k of allKeys) if (!order.includes(k)) order.push(k)
    const hidden = [...new Set(parsed.hidden)].filter((k) => known.has(k))
    return { order, hidden }
  } catch {
    return defaultLayout(allKeys)
  }
}

export function saveLayout(layout: DashboardLayout): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}

export function moveWidget(layout: DashboardLayout, key: string, dir: -1 | 1): DashboardLayout {
  const i = layout.order.indexOf(key)
  const j = i + dir
  if (i < 0 || j < 0 || j >= layout.order.length) return layout
  const order = [...layout.order]
  ;[order[i], order[j]] = [order[j], order[i]]
  return { ...layout, order }
}

export function setWidgetHidden(layout: DashboardLayout, key: string, hidden: boolean): DashboardLayout {
  const set = new Set(layout.hidden)
  if (hidden) set.add(key)
  else set.delete(key)
  return { ...layout, hidden: [...set] }
}
```

- [ ] **Step 5: Verify pass, full suite**

Run: `cd frontend && npx vitest run`
Expected: all green (30 existing + 7 new).

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/widgets/layout.ts frontend/src/widgets/layout.test.ts
git commit -m "feat(frontend): dashboard layout module + MUI X deps"
```

---

### Task 2: WidgetCard chrome + error boundary + count context

**Files:**
- Create: `frontend/src/widgets/WidgetCard.tsx`
- Test: `frontend/src/widgets/WidgetCard.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 (composed later by Dashboard).
- Produces:
  - `WidgetCard` props: `{ title: string; drillDown?: string; onRefresh: () => void; onMove: (dir: -1 | 1) => void; onHide: () => void; children: ReactNode }`. Navigation for the "open" action uses `useNavigate` internally with `drillDown`; button hidden when `drillDown` undefined.
  - `useWidgetCount(count: number | undefined): void` — hook a child widget calls to publish its live count into the chrome chip.
  - Internal `WidgetErrorBoundary` (class component) rendering `<Alert severity="error">` with the widget title; not exported.

- [ ] **Step 1: Write failing tests**

Create `frontend/src/widgets/WidgetCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { WidgetCard, useWidgetCount } from './WidgetCard'

function wrap(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  )
}

const noop = () => {}

function Boom(): React.ReactNode {
  throw new Error('widget exploded')
}

function Counter() {
  useWidgetCount(42)
  return <div>content</div>
}

describe('WidgetCard', () => {
  it('renders title and children', () => {
    wrap(
      <WidgetCard title="Deadlines" onRefresh={noop} onMove={noop} onHide={noop}>
        <div>hello</div>
      </WidgetCard>,
    )
    expect(screen.getByText('Deadlines')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('isolates child errors behind an Alert', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    wrap(
      <WidgetCard title="Broken" onRefresh={noop} onMove={noop} onHide={noop}>
        <Boom />
      </WidgetCard>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/Broken/)
    spy.mockRestore()
  })

  it('publishes child count into the chrome chip', () => {
    wrap(
      <WidgetCard title="Signals" onRefresh={noop} onMove={noop} onHide={noop}>
        <Counter />
      </WidgetCard>,
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('fires toolbar callbacks', () => {
    const onHide = vi.fn()
    const onRefresh = vi.fn()
    wrap(
      <WidgetCard title="T" onRefresh={onRefresh} onMove={noop} onHide={onHide}>
        <div />
      </WidgetCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: /refresh t/i }))
    fireEvent.click(screen.getByRole('button', { name: /hide t/i }))
    expect(onRefresh).toHaveBeenCalled()
    expect(onHide).toHaveBeenCalled()
  })

  it('omits open button without drillDown, shows it with one', () => {
    wrap(
      <WidgetCard title="A" onRefresh={noop} onMove={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    expect(screen.queryByRole('button', { name: /open a/i })).toBeNull()
    wrap(
      <WidgetCard title="B" drillDown="/deadlines" onRefresh={noop} onMove={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    expect(screen.getByRole('button', { name: /open b/i })).toBeInTheDocument()
  })

  it('expand opens a dialog re-rendering children', () => {
    wrap(
      <WidgetCard title="E" onRefresh={noop} onMove={noop} onHide={noop}>
        <div>inner-content</div>
      </WidgetCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: /expand e/i }))
    expect(screen.getAllByText('inner-content').length).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && npx vitest run src/widgets/WidgetCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement WidgetCard.tsx**

```tsx
import { Component, createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import { RefreshCw, Maximize2, ArrowUpRight, EyeOff, ChevronUp, ChevronDown } from 'lucide-react'

const CountContext = createContext<(n: number | undefined) => void>(() => {})

/** Child widgets publish their live item count into the chrome chip. */
export function useWidgetCount(count: number | undefined) {
  const setCount = useContext(CountContext)
  useEffect(() => {
    setCount(count)
    return () => setCount(undefined)
  }, [count, setCount])
}

class WidgetErrorBoundary extends Component<{ title: string; children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <Alert severity="error" sx={{ m: 1 }}>
          {this.props.title} failed to load: {this.state.error.message}
        </Alert>
      )
    }
    return this.props.children
  }
}

interface WidgetCardProps {
  title: string
  drillDown?: string
  onRefresh: () => void
  onMove: (dir: -1 | 1) => void
  onHide: () => void
  children: ReactNode
}

export function WidgetCard({ title, drillDown, onRefresh, onMove, onHide, children }: WidgetCardProps) {
  const [count, setCount] = useState<number | undefined>(undefined)
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const actions = (
    <Box
      className="widget-actions"
      sx={{ display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s', '@media (hover: none)': { opacity: 1 } }}
    >
      <Tooltip title="Move up"><IconButton size="small" aria-label={`Move ${title} up`} onClick={() => onMove(-1)}><ChevronUp size={14} /></IconButton></Tooltip>
      <Tooltip title="Move down"><IconButton size="small" aria-label={`Move ${title} down`} onClick={() => onMove(1)}><ChevronDown size={14} /></IconButton></Tooltip>
      <Tooltip title="Refresh"><IconButton size="small" aria-label={`Refresh ${title}`} onClick={onRefresh}><RefreshCw size={14} /></IconButton></Tooltip>
      <Tooltip title="Expand"><IconButton size="small" aria-label={`Expand ${title}`} onClick={() => setExpanded(true)}><Maximize2 size={14} /></IconButton></Tooltip>
      {drillDown && (
        <Tooltip title="Open view"><IconButton size="small" aria-label={`Open ${title}`} onClick={() => navigate(drillDown)}><ArrowUpRight size={14} /></IconButton></Tooltip>
      )}
      <Tooltip title="Hide"><IconButton size="small" aria-label={`Hide ${title}`} onClick={onHide}><EyeOff size={14} /></IconButton></Tooltip>
    </Box>
  )

  return (
    <CountContext.Provider value={setCount}>
      <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%', '&:hover .widget-actions': { opacity: 1 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 1, minHeight: 36 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>{title}</Typography>
          {count !== undefined && <Chip size="small" label={count} sx={{ height: 18, fontSize: 11 }} />}
          <Box sx={{ flex: 1 }} />
          {actions}
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, p: 1 }}>
          <WidgetErrorBoundary title={title}>{children}</WidgetErrorBoundary>
        </Box>
      </Paper>
      <Dialog open={expanded} onClose={() => setExpanded(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <WidgetErrorBoundary title={title}>{expanded && children}</WidgetErrorBoundary>
        </DialogContent>
      </Dialog>
    </CountContext.Provider>
  )
}
```

- [ ] **Step 4: Verify pass, full suite**

Run: `cd frontend && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/widgets/WidgetCard.tsx frontend/src/widgets/WidgetCard.test.tsx
git commit -m "feat(frontend): WidgetCard chrome — count chip, hover toolbar, error boundary, expand dialog"
```

---

### Task 3: KPI strip widget + registry

**Files:**
- Create: `frontend/src/widgets/KpiStrip.tsx`
- Create: `frontend/src/widgets/registry.ts`
- Test: `frontend/src/widgets/registry.test.ts`, `frontend/src/widgets/KpiStrip.test.tsx`

**Interfaces:**
- Consumes: `useWidgetCount` (not used here — tiles are their own counts), api fetchers.
- Produces:
  - `WidgetSize = 'sm' | 'md' | 'lg'`; `WidgetDef { key: string; title: string; size: WidgetSize; component: LazyExoticComponent<ComponentType>; drillDown?: string; queryKeys: string[][] }`
  - `WIDGETS: WidgetDef[]` — Task 3 registers only `kpi`; Tasks 4–6 append their entries.
  - `KpiStrip` default export (lazy-loadable): 6 stat tiles; each with a drill-down route navigates on click; Signals + Skill Runs tiles carry SparkLineChart from real history.

- [ ] **Step 1: Write failing registry test**

Create `frontend/src/widgets/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { WIDGETS } from './registry'

describe('widget registry', () => {
  it('has unique keys', () => {
    const keys = WIDGETS.map((w) => w.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every entry is complete', () => {
    for (const w of WIDGETS) {
      expect(w.key).toBeTruthy()
      expect(w.title).toBeTruthy()
      expect(['sm', 'md', 'lg']).toContain(w.size)
      expect(w.component).toBeTruthy()
      expect(Array.isArray(w.queryKeys)).toBe(true)
      if (w.drillDown) expect(w.drillDown.startsWith('/')).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Write failing KpiStrip test**

Create `frontend/src/widgets/KpiStrip.test.tsx` (mirror the fetch-mocking pattern used by the existing `src/views/Dashboard.test.tsx` — read it first; the shape below assumes a `fetch` stub):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import KpiStrip from './KpiStrip'

const outlook = {
  date: '2026-07-09',
  deadlines: [],
  top_trends: [],
  proactive: [{ id: 1, type: 'proactive', source: 's', title: 'p', status: 'new', priority: 2, created_at: '2026-07-09T10:00:00' }],
  tasks_due_today: [],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      if (String(url).includes('/api/outlook')) return outlook
      return []
    },
  })))
})

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('KpiStrip', () => {
  it('renders all six tiles with values', async () => {
    wrap(<KpiStrip />)
    expect(await screen.findByText('Proactive')).toBeInTheDocument()
    for (const label of ['Due Today', 'Urgent (<24h)', 'Rising', 'Signals', 'Skill Runs']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(await screen.findByText('1')).toBeInTheDocument() // proactive count
  })

  it('clickable tiles are links to filtered views', async () => {
    wrap(<KpiStrip />)
    const tile = await screen.findByRole('link', { name: /proactive/i })
    expect(tile).toHaveAttribute('href', '/inbox?type=proactive')
  })
})
```

- [ ] **Step 3: Run both to verify fail**

Run: `cd frontend && npx vitest run src/widgets`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement KpiStrip.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'
import { getOutlook, getDeadlines, getTrends, getSignals, getActivity } from '@/api'

const ACCENT = 'var(--color-accent)'

/** Daily counts for the last `days` days from ISO timestamps (oldest first). */
export function dailyCounts(isoDates: string[], days: number, today: Date): number[] {
  const counts = new Array<number>(days).fill(0)
  const dayMs = 86400000
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() + dayMs
  for (const iso of isoDates) {
    const t = new Date(iso).getTime()
    const idx = days - 1 - Math.floor((end - 1 - t) / dayMs)
    if (idx >= 0 && idx < days) counts[idx] += 1
  }
  return counts
}

interface Tile {
  label: string
  value: number
  to?: string
  spark?: number[]
}

function StatTile({ tile }: { tile: Tile }) {
  const inner = (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 0.5, '&:hover': tile.to ? { borderColor: 'primary.main' } : undefined }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>{tile.label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <Typography variant="h5" fontFamily='"JetBrains Mono", monospace' color="primary">{tile.value}</Typography>
        {tile.spark && tile.spark.some((v) => v > 0) && (
          <Box sx={{ flex: 1, height: 28, minWidth: 0 }}>
            <SparkLineChart data={tile.spark} height={28} color={ACCENT} />
          </Box>
        )}
      </Box>
    </Paper>
  )
  return tile.to ? (
    <Link to={tile.to} aria-label={tile.label} style={{ textDecoration: 'none' }}>{inner}</Link>
  ) : inner
}

export default function KpiStrip() {
  const { data: outlook } = useQuery({ queryKey: ['outlook'], queryFn: getOutlook, refetchInterval: 15000 })
  const { data: deadlines = [] } = useQuery({ queryKey: ['deadlines'], queryFn: getDeadlines, refetchInterval: 15000 })
  const { data: trends = [] } = useQuery({ queryKey: ['trends'], queryFn: () => getTrends(), refetchInterval: 15000 })
  const { data: signals = [] } = useQuery({ queryKey: ['signals', 'new'], queryFn: () => getSignals('new'), refetchInterval: 15000 })
  const { data: activity = [] } = useQuery({ queryKey: ['activity'], queryFn: () => getActivity(10), refetchInterval: 15000 })

  const now = new Date()
  const tiles: Tile[] = [
    { label: 'Proactive', value: outlook?.proactive?.length ?? 0, to: '/inbox?type=proactive' },
    { label: 'Due Today', value: outlook?.tasks_due_today?.length ?? 0, to: '/tasks?due=today' },
    { label: 'Urgent (<24h)', value: deadlines.filter((d) => d.countdown_seconds < 86400).length, to: '/deadlines?due=24h' },
    { label: 'Rising', value: trends.filter((t) => (t.delta ?? 0) > 0).length, to: '/trending?dir=rising' },
    { label: 'Signals', value: signals.filter((s) => s.type !== 'proactive').length, to: '/inbox?status=new', spark: dailyCounts(signals.map((s) => s.created_at), 7, now) },
    { label: 'Skill Runs', value: activity.length, spark: [...activity].reverse().map((a) => a.items_created) },
  ]

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 1.5 }}>
      {tiles.map((t) => <StatTile key={t.label} tile={t} />)}
    </Box>
  )
}
```

- [ ] **Step 5: Implement registry.ts**

```ts
import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

export type WidgetSize = 'sm' | 'md' | 'lg'

export interface WidgetDef {
  key: string
  title: string
  /** grid span: sm=4, md=6, lg=12 of 12 columns */
  size: WidgetSize
  component: LazyExoticComponent<ComponentType>
  /** route the "open view" action navigates to; omit for expand-only widgets */
  drillDown?: string
  /** TanStack Query keys the refresh action invalidates */
  queryKeys: string[][]
}

// Adding a data source = create one widget file + append one entry here.
export const WIDGETS: WidgetDef[] = [
  {
    key: 'kpi',
    title: 'Key Metrics',
    size: 'lg',
    component: lazy(() => import('./KpiStrip')),
    queryKeys: [['outlook'], ['deadlines'], ['trends'], ['signals'], ['activity']],
  },
]
```

- [ ] **Step 6: Add a dailyCounts unit test**

Append to `frontend/src/widgets/KpiStrip.test.tsx`:

```tsx
import { dailyCounts } from './KpiStrip'

describe('dailyCounts', () => {
  it('buckets timestamps into trailing days, oldest first', () => {
    const today = new Date('2026-07-09T12:00:00')
    const counts = dailyCounts(
      ['2026-07-09T01:00:00', '2026-07-09T23:00:00', '2026-07-07T09:00:00', '2026-06-01T00:00:00'],
      3,
      today,
    )
    expect(counts).toEqual([1, 0, 2])
  })
})
```

- [ ] **Step 7: Verify pass, full suite**

Run: `cd frontend && npx vitest run`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/widgets
git commit -m "feat(frontend): widget registry + KPI strip with real-history sparklines"
```

---

### Task 4: Deadlines + Signals widgets (compact DataGrid)

**Files:**
- Create: `frontend/src/widgets/DeadlinesWidget.tsx`
- Create: `frontend/src/widgets/SignalsWidget.tsx`
- Modify: `frontend/src/widgets/registry.ts` (append 2 entries)
- Test: `frontend/src/widgets/DeadlinesWidget.test.tsx`

**Interfaces:**
- Consumes: `useWidgetCount` from `./WidgetCard`; `getDeadlines`, `getSignals` from `@/api`; `WidgetDef` shape from Task 3.
- Produces: default-export components `DeadlinesWidget`, `SignalsWidget`; registry entries `deadlines` (drillDown `/deadlines`), `signals` (drillDown `/inbox?status=new`).

- [ ] **Step 1: Write failing test**

Create `frontend/src/widgets/DeadlinesWidget.test.tsx` (same wrap/fetch-stub pattern as KpiStrip.test):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import DeadlinesWidget from './DeadlinesWidget'

const rows = [
  { id: 1, title: 'Ship report', due_at: '2026-07-09T18:00:00', countdown_seconds: 3600, source: 'manual', status: 'active', visible: 1 },
  { id: 2, title: 'Renew cert', due_at: '2026-08-01T09:00:00', countdown_seconds: 900000, source: 'manual', status: 'active', visible: 1 },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => rows })))
})

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('DeadlinesWidget', () => {
  it('renders rows sorted by countdown with formatted countdown', async () => {
    wrap(<DeadlinesWidget />)
    expect(await screen.findByText('Ship report')).toBeInTheDocument()
    expect(screen.getByText('1h 0m')).toBeInTheDocument()
    expect(screen.getByText('Renew cert')).toBeInTheDocument()
  })

  it('shows empty state without rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })))
    wrap(<DeadlinesWidget />)
    expect(await screen.findByText(/no deadlines/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && npx vitest run src/widgets/DeadlinesWidget.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement DeadlinesWidget.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import { getDeadlines, type Deadline } from '@/api'
import { useWidgetCount } from './WidgetCard'

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'overdue'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 24) return `${Math.floor(h / 24)}d`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const columns: GridColDef<Deadline>[] = [
  {
    field: 'title',
    headerName: 'Deadline',
    flex: 1,
    renderCell: (p) => (
      <Tooltip
        title={
          <Box sx={{ p: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>{p.row.title}</Typography>
            <Typography variant="caption">Due {new Date(p.row.due_at).toLocaleString()}</Typography>
            {p.row.detail && <Typography variant="caption" display="block">{p.row.detail}</Typography>}
            <Typography variant="caption" color="text.secondary" display="block">source: {p.row.source}</Typography>
          </Box>
        }
      >
        <span>{p.row.title}</span>
      </Tooltip>
    ),
  },
  {
    field: 'countdown_seconds',
    headerName: 'In',
    width: 90,
    renderCell: (p) => (
      <Typography
        variant="caption"
        fontFamily='"JetBrains Mono", monospace'
        color={p.value <= 0 ? 'error.main' : p.value < 86400 ? 'warning.main' : 'text.secondary'}
      >
        {formatCountdown(p.value)}
      </Typography>
    ),
  },
]

export default function DeadlinesWidget() {
  const { data = [], isLoading } = useQuery({ queryKey: ['deadlines'], queryFn: getDeadlines, refetchInterval: 15000 })
  const navigate = useNavigate()
  const rows = [...data].sort((a, b) => a.countdown_seconds - b.countdown_seconds)
  useWidgetCount(rows.length)

  if (!isLoading && rows.length === 0) {
    return <Typography variant="caption" color="text.secondary">No deadlines tracked.</Typography>
  }
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={isLoading}
      density="compact"
      hideFooter
      disableColumnMenu
      onRowClick={() => navigate('/deadlines')}
      sx={{ border: 0, cursor: 'pointer', maxHeight: 320 }}
    />
  )
}
```

- [ ] **Step 4: Implement SignalsWidget.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import { getSignals, type Signal } from '@/api'
import { useWidgetCount } from './WidgetCard'

export function relativeTime(isoStr: string, now = new Date()): string {
  const diff = Math.floor((now.getTime() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const PRIORITY_COLOR: Record<number, string> = { 1: 'error.main', 2: 'warning.main' }

const columns: GridColDef<Signal>[] = [
  {
    field: 'priority',
    headerName: '',
    width: 36,
    renderCell: (p) => (
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_COLOR[p.value] ?? 'info.main' }} aria-label={`priority ${p.value}`} />
    ),
  },
  {
    field: 'title',
    headerName: 'Signal',
    flex: 1,
    renderCell: (p) => (
      <Tooltip
        title={
          <Box sx={{ p: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>{p.row.title}</Typography>
            <Typography variant="caption" display="block">{p.row.source}{p.row.source_skill ? ` · ${p.row.source_skill}` : ''}</Typography>
            <Typography variant="caption" color="text.secondary">{new Date(p.row.created_at).toLocaleString()} · priority {p.row.priority}</Typography>
          </Box>
        }
      >
        <span>{p.row.title}</span>
      </Tooltip>
    ),
  },
  {
    field: 'created_at',
    headerName: 'When',
    width: 80,
    renderCell: (p) => (
      <Typography variant="caption" fontFamily='"JetBrains Mono", monospace' color="text.secondary">{relativeTime(p.value)}</Typography>
    ),
  },
]

export default function SignalsWidget() {
  const { data = [], isLoading } = useQuery({ queryKey: ['signals', 'new'], queryFn: () => getSignals('new'), refetchInterval: 15000 })
  const navigate = useNavigate()
  const rows = data.filter((s) => s.type !== 'proactive')
  useWidgetCount(rows.length)

  if (!isLoading && rows.length === 0) {
    return <Typography variant="caption" color="text.secondary">No new signals.</Typography>
  }
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={isLoading}
      density="compact"
      hideFooter
      disableColumnMenu
      onRowClick={() => navigate('/inbox?status=new')}
      sx={{ border: 0, cursor: 'pointer', maxHeight: 320 }}
    />
  )
}
```

- [ ] **Step 5: Append registry entries**

In `frontend/src/widgets/registry.ts`, append to `WIDGETS`:

```ts
  {
    key: 'deadlines',
    title: 'Deadlines',
    size: 'md',
    component: lazy(() => import('./DeadlinesWidget')),
    drillDown: '/deadlines',
    queryKeys: [['deadlines']],
  },
  {
    key: 'signals',
    title: 'Signals',
    size: 'md',
    component: lazy(() => import('./SignalsWidget')),
    drillDown: '/inbox?status=new',
    queryKeys: [['signals']],
  },
```

- [ ] **Step 6: Verify pass, full suite**

Run: `cd frontend && npx vitest run`
Expected: all green (registry completeness test covers new entries automatically).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/widgets
git commit -m "feat(frontend): deadlines + signals widgets (compact DataGrid, quick-peek tooltips)"
```

---

### Task 5: Trending + Skill Activity widgets (MUI X BarChart)

**Files:**
- Create: `frontend/src/widgets/TrendingWidget.tsx`
- Create: `frontend/src/widgets/ActivityWidget.tsx`
- Modify: `frontend/src/widgets/registry.ts` (append 2 entries)
- Test: `frontend/src/widgets/TrendingWidget.test.tsx`

**Interfaces:**
- Consumes: `useWidgetCount`, `getTrends`, `getActivity`, registry shape.
- Produces: default exports `TrendingWidget`, `ActivityWidget`; registry entries `trending` (drillDown `/trending?dir=rising`), `activity` (no drillDown — expand-only per spec: no activity view exists).

- [ ] **Step 1: Write failing test**

Create `frontend/src/widgets/TrendingWidget.test.tsx` (same wrap/stub pattern as Task 4 test — repeat the `wrap` helper verbatim):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import TrendingWidget from './TrendingWidget'

const rows = [
  { id: 1, term: 'AI Strategy', kind: 'topic', window_start: '', window_end: '', score: 85, delta: 8 },
  { id: 2, term: 'Vendor Risk', kind: 'topic', window_start: '', window_end: '', score: 45, delta: -3 },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => rows })))
})

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('TrendingWidget', () => {
  it('lists terms with delta chips', async () => {
    wrap(<TrendingWidget />)
    expect(await screen.findByText('AI Strategy')).toBeInTheDocument()
    expect(screen.getByText('+8%')).toBeInTheDocument()
    expect(screen.getByText('-3%')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })))
    wrap(<TrendingWidget />)
    expect(await screen.findByText(/no trends/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && npx vitest run src/widgets/TrendingWidget.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement TrendingWidget.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { BarChart } from '@mui/x-charts/BarChart'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { getTrends } from '@/api'
import { useWidgetCount } from './WidgetCard'

const ACCENT = 'var(--color-accent)'

export default function TrendingWidget() {
  const { data = [], isLoading } = useQuery({ queryKey: ['trends'], queryFn: () => getTrends(), refetchInterval: 15000 })
  const top = [...data].sort((a, b) => b.score - a.score).slice(0, 5)
  useWidgetCount(data.length)

  if (!isLoading && top.length === 0) {
    return <Typography variant="caption" color="text.secondary">No trends yet.</Typography>
  }
  return (
    <Box>
      <BarChart
        height={140}
        series={[{ data: top.map((t) => t.score), color: ACCENT, valueFormatter: (v) => `${v}` }]}
        xAxis={[{ scaleType: 'band', data: top.map((t) => t.term), tickLabelStyle: { fontSize: 10 } }]}
        barLabel="value"
        borderRadius={4}
        margin={{ top: 8, bottom: 4 }}
        hideLegend
      />
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {top.map((t) => (
          <Box
            key={t.id}
            component={Link}
            to="/trending?dir=rising"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1, textDecoration: 'none', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>{t.term}</Typography>
            <Chip
              size="small"
              variant="outlined"
              icon={(t.delta ?? 0) > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              label={t.delta != null ? `${t.delta > 0 ? '+' : ''}${t.delta}%` : '—'}
              color={(t.delta ?? 0) > 0 ? 'success' : 'default'}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
```

- [ ] **Step 4: Implement ActivityWidget.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import { BarChart } from '@mui/x-charts/BarChart'
import { Check, X } from 'lucide-react'
import { getActivity } from '@/api'
import { useWidgetCount } from './WidgetCard'

const ACCENT = 'var(--color-accent)'

export default function ActivityWidget() {
  const { data = [], isLoading } = useQuery({ queryKey: ['activity'], queryFn: () => getActivity(10), refetchInterval: 15000 })
  useWidgetCount(data.length)

  if (!isLoading && data.length === 0) {
    return <Typography variant="caption" color="text.secondary">No skill runs yet.</Typography>
  }

  // aggregate items created per skill (identity = skill, magnitude = items)
  const bySkill = new Map<string, number>()
  for (const a of data) bySkill.set(a.skill, (bySkill.get(a.skill) ?? 0) + a.items_created)
  const skills = [...bySkill.keys()]

  return (
    <Box>
      <BarChart
        height={150}
        series={[{ data: skills.map((s) => bySkill.get(s) ?? 0), color: ACCENT }]}
        xAxis={[{ scaleType: 'band', data: skills, tickLabelStyle: { fontSize: 10, angle: -25 } }]}
        barLabel="value"
        borderRadius={4}
        margin={{ top: 8, bottom: 24 }}
        hideLegend
      />
      <Stack spacing={0.25} sx={{ mt: 1 }}>
        {data.slice(0, 5).map((a) => (
          <Tooltip key={a.id} title={`${a.skill} — ${a.items_created} items · ${a.status}${a.note ? ` · ${a.note}` : ''}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.25 }}>
              {a.status === 'error'
                ? <X size={13} aria-label="error" style={{ color: 'var(--mui-palette-error-main)' }} />
                : <Check size={13} aria-label="ok" style={{ color: 'var(--mui-palette-success-main)' }} />}
              <Typography variant="caption" fontFamily='"JetBrains Mono", monospace' sx={{ flex: 1 }} noWrap>{a.skill}</Typography>
              <Typography variant="caption" color="text.secondary">{a.items_created} items</Typography>
            </Box>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  )
}
```

- [ ] **Step 5: Append registry entries**

```ts
  {
    key: 'trending',
    title: 'Trending',
    size: 'md',
    component: lazy(() => import('./TrendingWidget')),
    drillDown: '/trending?dir=rising',
    queryKeys: [['trends']],
  },
  {
    key: 'activity',
    title: 'Skill Activity',
    size: 'md',
    component: lazy(() => import('./ActivityWidget')),
    queryKeys: [['activity']],
  },
```

- [ ] **Step 6: Verify pass, full suite**

Run: `cd frontend && npx vitest run`
Expected: all green. (If jsdom chokes on chart SVG rendering, MUI X Charts render fine in jsdom as of v8; if a specific internal errors, mock nothing — report BLOCKED with the error.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/widgets
git commit -m "feat(frontend): trending + skill activity widgets (MUI X BarChart, direct labels)"
```

---

### Task 6: Today widget + Dashboard assembly (grid, edit mode, persistence)

**Files:**
- Create: `frontend/src/widgets/TodayWidget.tsx`
- Modify: `frontend/src/widgets/registry.ts` (append 1 entry)
- Rewrite: `frontend/src/views/Dashboard.tsx`
- Modify: `frontend/src/views/Dashboard.test.tsx` (replace with widget-era tests)

**Interfaces:**
- Consumes: everything from Tasks 1–5 (`WIDGETS`, layout module functions, `WidgetCard`), `getEvents`, `getTasks`.
- Produces: `DashboardView` named export (route `/` unchanged); `TodayWidget` default export; registry entry `today` (drillDown `/calendar`).

- [ ] **Step 1: Implement TodayWidget.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import { Calendar, CheckSquare } from 'lucide-react'
import { getEvents, getTasks } from '@/api'
import { useWidgetCount } from './WidgetCard'

function isToday(iso?: string): boolean {
  if (!iso) return false
  return new Date(iso).toDateString() === new Date().toDateString()
}

export default function TodayWidget() {
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: getEvents, refetchInterval: 15000 })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 15000 })

  const todaysEvents = events.filter((e) => isToday(e.chosen_time))
  const dueTasks = tasks.filter((t) => t.status !== 'done' && isToday(t.due_at))
  useWidgetCount(todaysEvents.length + dueTasks.length)

  if (todaysEvents.length === 0 && dueTasks.length === 0) {
    return <Typography variant="caption" color="text.secondary">Nothing scheduled today.</Typography>
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      <Stack spacing={0.5}>
        <Typography variant="overline" color="text.secondary">Events</Typography>
        {todaysEvents.length === 0 && <Typography variant="caption" color="text.secondary">None today.</Typography>}
        {todaysEvents.map((e) => (
          <Box key={e.id} component={Link} to="/calendar" sx={{ display: 'flex', gap: 1, alignItems: 'center', textDecoration: 'none', color: 'text.primary', px: 1, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
            <Calendar size={13} />
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>{e.title}</Typography>
            {e.chosen_time && <Typography variant="caption" fontFamily='"JetBrains Mono", monospace' color="text.secondary">{new Date(e.chosen_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>}
          </Box>
        ))}
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="overline" color="text.secondary">Tasks due</Typography>
        {dueTasks.length === 0 && <Typography variant="caption" color="text.secondary">None due.</Typography>}
        {dueTasks.map((t) => (
          <Box key={t.id} component={Link} to="/tasks?due=today" sx={{ display: 'flex', gap: 1, alignItems: 'center', textDecoration: 'none', color: 'text.primary', px: 1, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
            <CheckSquare size={13} />
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>{t.title}</Typography>
            {t.priority <= 1 && <Chip size="small" label="P1" color="error" variant="outlined" sx={{ height: 16, fontSize: 10 }} />}
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
```

Registry entry:

```ts
  {
    key: 'today',
    title: 'Today',
    size: 'lg',
    component: lazy(() => import('./TodayWidget')),
    drillDown: '/calendar',
    queryKeys: [['events'], ['tasks']],
  },
```

- [ ] **Step 2: Write failing Dashboard tests**

Replace `frontend/src/views/Dashboard.test.tsx` content:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { DashboardView } from './Dashboard'
import { WIDGETS } from '../widgets/registry'
import { LAYOUT_KEY } from '../widgets/layout'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes('/api/outlook')
      ? { date: '', deadlines: [], top_trends: [], proactive: [], tasks_due_today: [] }
      : []),
  })))
})

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <DashboardView />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('DashboardView (widget grid)', () => {
  it('renders every registered visible widget title', async () => {
    wrap()
    for (const w of WIDGETS) {
      expect(await screen.findByText(w.title)).toBeInTheDocument()
    }
  })

  it('hide persists to layout storage', async () => {
    wrap()
    const hide = await screen.findByRole('button', { name: /hide deadlines/i })
    fireEvent.click(hide)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!)
      expect(stored.hidden).toContain('deadlines')
    })
    expect(screen.queryByText('Deadlines')).toBeNull()
  })

  it('hidden widgets come back via Add widget menu', async () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ order: WIDGETS.map((w) => w.key), hidden: ['deadlines'] }))
    wrap()
    fireEvent.click(await screen.findByRole('button', { name: /add widget/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /deadlines/i }))
    expect(await screen.findByText('Deadlines')).toBeInTheDocument()
  })

  it('move down persists new order', async () => {
    wrap()
    fireEvent.click(await screen.findByRole('button', { name: /move key metrics down/i }))
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!)
      expect(stored.order.indexOf('kpi')).toBe(1)
    })
  })
})
```

- [ ] **Step 3: Run to verify fail**

Run: `cd frontend && npx vitest run src/views/Dashboard.test.tsx`
Expected: FAIL — old DashboardView has none of this.

- [ ] **Step 4: Rewrite Dashboard.tsx**

```tsx
import { Suspense, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { Plus, RotateCcw } from 'lucide-react'
import { WIDGETS, type WidgetSize } from '@/widgets/registry'
import { WidgetCard } from '@/widgets/WidgetCard'
import {
  defaultLayout, loadLayout, saveLayout, moveWidget, setWidgetHidden,
} from '@/widgets/layout'

const SPAN: Record<WidgetSize, { xs: string; md: string }> = {
  sm: { xs: 'span 12', md: 'span 4' },
  md: { xs: 'span 12', md: 'span 6' },
  lg: { xs: 'span 12', md: 'span 12' },
}

const ALL_KEYS = WIDGETS.map((w) => w.key)

export function DashboardView() {
  const [layout, setLayoutState] = useState(() => loadLayout(ALL_KEYS))
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null)
  const queryClient = useQueryClient()

  const setLayout = (next: typeof layout) => {
    setLayoutState(next)
    saveLayout(next)
  }

  const hidden = useMemo(() => new Set(layout.hidden), [layout])
  const visible = layout.order.filter((k) => !hidden.has(k))
  const hiddenDefs = WIDGETS.filter((w) => hidden.has(w.key))

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Button size="small" startIcon={<Plus size={14} />} disabled={hiddenDefs.length === 0} onClick={(e) => setAddAnchor(e.currentTarget)} aria-label="Add widget">
          Add widget
        </Button>
        <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => setLayout(defaultLayout(ALL_KEYS))} aria-label="Reset layout">
          Reset
        </Button>
        <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
          {hiddenDefs.map((w) => (
            <MenuItem key={w.key} onClick={() => { setLayout(setWidgetHidden(layout, w.key, false)); setAddAnchor(null) }}>
              {w.title}
            </MenuItem>
          ))}
        </Menu>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
        {visible.map((key) => {
          const def = WIDGETS.find((w) => w.key === key)
          if (!def) return null
          const W = def.component
          return (
            <Box key={key} sx={{ gridColumn: SPAN[def.size] }}>
              <WidgetCard
                title={def.title}
                drillDown={def.drillDown}
                onRefresh={() => def.queryKeys.forEach((qk) => queryClient.invalidateQueries({ queryKey: qk }))}
                onMove={(dir) => setLayout(moveWidget(layout, key, dir))}
                onHide={() => setLayout(setWidgetHidden(layout, key, true))}
              >
                <Suspense fallback={<Skeleton variant="rounded" height={120} />}>
                  <W />
                </Suspense>
              </WidgetCard>
            </Box>
          )
        })}
        {visible.length === 0 && (
          <Box sx={{ gridColumn: 'span 12', textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">All widgets hidden — use “Add widget” to bring them back.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 5: Verify pass, full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/widgets frontend/src/views/Dashboard.tsx frontend/src/views/Dashboard.test.tsx
git commit -m "feat(frontend): widget-grid dashboard — edit mode, layout persistence, today widget"
```

---

### Task 7: Drill-down query params in target views

**Files:**
- Modify: `frontend/src/views/Deadlines.tsx` (parse `due=24h`)
- Modify: `frontend/src/views/Trending.tsx` (parse `dir=rising`)
- Modify: `frontend/src/views/Inbox.tsx` (parse `status=new`, `type=proactive`)
- Modify: `frontend/src/views/Tasks.tsx` (parse `due=today`)
- Test: add one test per view in each view's existing `*.test.tsx`

**Interfaces:**
- Consumes: routes emitted by widgets: `/deadlines?due=24h`, `/trending?dir=rising`, `/inbox?status=new`, `/inbox?type=proactive`, `/tasks?due=today`.
- Produces: each view pre-filters its list when the param is present; no param = unchanged behavior. Views keep their current internal filter/tab UI — the param only sets the initial state or applies one extra filter predicate.

- [ ] **Step 1: Read the four views**

Read each view file first. They are Tailwind-era list views with their own state; the change per view is: `import { useSearchParams } from 'react-router-dom'`, read the param once, apply.

- [ ] **Step 2: Per-view change (pattern, apply to each)**

Deadlines (`Deadlines.tsx`) — after the deadlines query, before render:

```tsx
const [searchParams] = useSearchParams()
const urgentOnly = searchParams.get('due') === '24h'
const visibleDeadlines = urgentOnly
  ? deadlines.filter((d) => d.countdown_seconds < 86400)
  : deadlines
```

Render from `visibleDeadlines`; when `urgentOnly`, show a dismissible indicator chip: `<Chip label="Due <24h" onDelete={() => setSearchParams({})} size="small" />` (import `Chip` from MUI, get `setSearchParams` from the same hook call).

Trending (`Trending.tsx`):

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const risingOnly = searchParams.get('dir') === 'rising'
const visibleTrends = risingOnly ? trends.filter((t) => (t.delta ?? 0) > 0) : trends
```

Same chip pattern (`label="Rising"`).

Inbox (`Inbox.tsx`): if the view has status tabs, initialize the active tab from `searchParams.get('status') ?? <current default>`; additionally `const proactiveOnly = searchParams.get('type') === 'proactive'` filters `s.type === 'proactive'`. Same chip pattern for the type filter.

Tasks (`Tasks.tsx`):

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const dueToday = searchParams.get('due') === 'today'
const visibleTasks = dueToday
  ? tasks.filter((t) => t.due_at && new Date(t.due_at).toDateString() === new Date().toDateString())
  : tasks
```

Same chip pattern (`label="Due today"`).

- [ ] **Step 3: One test per view (TDD: write before each view's change)**

Pattern (adapt entity/fixtures per view; add to the view's existing test file, reusing its render helpers but with `MemoryRouter initialEntries`):

```tsx
it('pre-filters via drill-down query param', async () => {
  // fixtures: one matching row, one non-matching row (e.g. countdown 3600 vs 900000)
  render(/* existing provider wrapper */
    <MemoryRouter initialEntries={['/deadlines?due=24h']}>
      <DeadlinesView />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Ship report')).toBeInTheDocument()   // matching
  expect(screen.queryByText('Renew cert')).toBeNull()                  // filtered out
})
```

Note: existing view tests may render without a router — those views now call `useSearchParams`, so wrap ALL renders of these four views in `<MemoryRouter>`.

- [ ] **Step 4: Full suite**

Run: `cd frontend && npx vitest run`
Expected: all green (4 new tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views
git commit -m "feat(frontend): views honor drill-down query params (due/dir/status/type)"
```

---

### Task 8: Verification — suites, build, visual

**Files:** none.

- [ ] **Step 1: Full suites + typecheck + build**

```bash
cd frontend && npx vitest run && npx tsc -b && npm run build
cd ../backend && source ../.venv/bin/activate && python -m pytest -q
```

Expected: all green.

- [ ] **Step 2: Deploy build + live check**

```bash
cd /home/user/code/Scout_EA && rm -rf frontend_dist && cp -r frontend/dist frontend_dist
source .venv/bin/activate && python -c "import sys; sys.path.insert(0, 'backend'); import seed_demo; seed_demo.seed('ea.sqlite')"
python backend/run_web.py &   # :8765
```

**CRITICAL:** `run_web.py` serves repo-root `frontend_dist/`, NOT `frontend/dist` — always copy after build.

- [ ] **Step 3: Playwright screenshots (dark+light)**

Screenshot `/` (dashboard) in dark and light at 1440×900 (script pattern: launch chromium with `executablePath: '/usr/bin/google-chrome'`, `addInitScript` seeding `ea-theme` + `ea-briefing-shown`, run from `frontend/` for module resolution). Verify visually:
- All 6 widgets render with data (seeded), counts in chips
- Sparklines on Signals/Skill Runs tiles; bar labels visible on charts (light mode especially)
- Hover toolbar appears on widget hover (screenshot with `page.hover` on one card)
- Click a KPI tile → lands on filtered view with indicator chip (screenshot `/deadlines?due=24h`)
- Colors correct in BOTH modes; empty states not shown with seeded data

- [ ] **Step 4: Kill server, note bundle sizes**

```bash
pkill -f run_web.py
ls -la frontend/dist/assets/*.js | sort -k5 -n | tail -5
```

Record main-chunk size in ledger (Phase 1 baseline: 525KB; MUI X will add — if main chunk exceeds ~700KB, note manualChunks vendor-split as a Phase 3 item, do not implement now).

---

## Self-Review Notes

- Spec coverage: registry+contract (T3), layout persistence + edit mode (T1/T6), WidgetCard chrome incl. count chip/refresh/expand/open/hide + error boundary + skeleton (T2), 6 widgets exactly as spec'd (T3-T6; KPI sparklines limited to real-history tiles — deliberate honesty deviation from "each with mini-trend", documented in Global Constraints), Popover quick-peeks implemented as rich MUI Tooltips (hover-managed, accessible — same UX, less custom code), drill-down deep links + param parsing in the 4 target views (T7), unknown-key-skipped (T1 load test), data layer unchanged.
- Charts follow dataviz validation: single accent hue via CSS var (tracks personalization), barLabel="value" (light-mode 2.85:1 relief), status colors only for status, one axis, radius 4.
- Type consistency: `WidgetDef.queryKeys: string[][]` consumed by Dashboard refresh; `useWidgetCount` produced in T2, consumed T4-T6; layout functions produced T1, consumed T6 — names match throughout.
