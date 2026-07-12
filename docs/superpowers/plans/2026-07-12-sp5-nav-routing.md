# SP-5 Nav/Routing Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut sidebar from 11 flat items to 8 grouped items by mounting existing views inside three tabbed container views, driven by a single route registry — non-destructively.

**Architecture:** One `nav.ts` registry is the single source of truth for Sidebar, CommandPalette navigation, and App routes. Three new container views (`Review`, `Schedule`, `Automations`) render existing views as tabs via a generic `TabbedView`. Old routes redirect to new paths (with `?tab=`) so bookmarks and `⌘K` deep links survive. Existing view components are unchanged — only re-homed.

**Tech Stack:** React 19, react-router-dom 7, MUI 9, TanStack Query, Vitest + Testing Library, lucide-react icons.

## Global Constraints

- Frontend only. No backend/API changes.
- No existing view component (Inbox, Actions, Calendar, Deadlines, Skills, Activity, Tasks, Dashboard, DataFeed, People, Settings) is modified — they are mounted as-is.
- Reuse lucide-react icons already imported elsewhere: `Grid3x3, Inbox, CheckSquare, Calendar, Newspaper, Users, Zap, Cog`.
- Preserve all deep links via redirects — no route may 404 that worked before.
- All new logic ships with a Vitest test; run `npm test` from `frontend/` (never partial-green claims).
- Follow existing import style: `@/` alias, named exports on views, `lazy(() => import(...).then(m => ({ default: m.XView })))`.

---

### Task 1: Route registry (`nav.ts`)

**Files:**
- Create: `frontend/src/nav.ts`
- Test: `frontend/src/nav.test.ts`

**Interfaces:**
- Produces: `NavItem { id: string; path: string; label: string; icon: LucideIcon; group: NavGroupId }`, `NavGroupId = 'work' | 'knowledge' | 'system'`, `NAV: NavItem[]` (8 items), `NAV_GROUPS: { id: NavGroupId; label: string }[]`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/nav.test.ts
import { describe, it, expect } from 'vitest'
import { NAV, NAV_GROUPS } from './nav'

describe('nav registry', () => {
  it('has exactly 8 items', () => {
    expect(NAV).toHaveLength(8)
  })
  it('has unique ids and paths', () => {
    expect(new Set(NAV.map((n) => n.id)).size).toBe(8)
    expect(new Set(NAV.map((n) => n.path)).size).toBe(8)
  })
  it('home is the root path', () => {
    expect(NAV.find((n) => n.id === 'home')?.path).toBe('/')
  })
  it('every item belongs to a declared group', () => {
    const groups = new Set(NAV_GROUPS.map((g) => g.id))
    for (const n of NAV) expect(groups.has(n.group)).toBe(true)
  })
  it('declares the three consolidated destinations', () => {
    const paths = NAV.map((n) => n.path)
    expect(paths).toEqual(
      expect.arrayContaining(['/review', '/schedule', '/automations']),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/nav.test.ts`
Expected: FAIL — cannot resolve `./nav`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/nav.ts
import { Grid3x3, Inbox, CheckSquare, Calendar, Newspaper, Users, Zap, Cog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavGroupId = 'work' | 'knowledge' | 'system'

export interface NavItem {
  id: string
  path: string
  label: string
  icon: LucideIcon
  group: NavGroupId
}

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'system', label: 'System' },
]

export const NAV: NavItem[] = [
  { id: 'home', path: '/', label: 'Home', icon: Grid3x3, group: 'work' },
  { id: 'review', path: '/review', label: 'Review', icon: Inbox, group: 'work' },
  { id: 'tasks', path: '/tasks', label: 'Tasks', icon: CheckSquare, group: 'work' },
  { id: 'schedule', path: '/schedule', label: 'Schedule', icon: Calendar, group: 'work' },
  { id: 'feed', path: '/feed', label: 'Data Feed', icon: Newspaper, group: 'knowledge' },
  { id: 'people', path: '/people', label: 'People', icon: Users, group: 'knowledge' },
  { id: 'automations', path: '/automations', label: 'Automations', icon: Zap, group: 'system' },
  { id: 'settings', path: '/settings', label: 'Settings', icon: Cog, group: 'system' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/nav.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/nav.ts frontend/src/nav.test.ts
git commit -m "feat(nav): route registry as single source for sidebar/palette/routes"
```

---

### Task 2: Generic `TabbedView` container

**Files:**
- Create: `frontend/src/components/TabbedView.tsx`
- Test: `frontend/src/components/TabbedView.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `ViewTab { id: string; label: string; element: React.ReactNode }`; `TabbedView({ tabs, ariaLabel }: { tabs: ViewTab[]; ariaLabel: string })`. Active tab read from `?tab=`; defaults to `tabs[0]`; changing tab writes `?tab=` with `replace: true`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/TabbedView.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TabbedView } from './TabbedView'

const tabs = [
  { id: 'one', label: 'One', element: <div>PANEL ONE</div> },
  { id: 'two', label: 'Two', element: <div>PANEL TWO</div> },
]

function wrap(initial = '/x') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <TabbedView tabs={tabs} ariaLabel="test tabs" />
    </MemoryRouter>,
  )
}

describe('TabbedView', () => {
  it('shows first tab panel by default', () => {
    wrap()
    expect(screen.getByText('PANEL ONE')).toBeInTheDocument()
    expect(screen.queryByText('PANEL TWO')).toBeNull()
  })
  it('honors ?tab= in the url', () => {
    wrap('/x?tab=two')
    expect(screen.getByText('PANEL TWO')).toBeInTheDocument()
  })
  it('switches panel on tab click', () => {
    wrap()
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
    expect(screen.getByText('PANEL TWO')).toBeInTheDocument()
  })
  it('falls back to first tab for an unknown ?tab=', () => {
    wrap('/x?tab=nope')
    expect(screen.getByText('PANEL ONE')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/TabbedView.test.tsx`
Expected: FAIL — cannot resolve `./TabbedView`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/TabbedView.tsx
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

export interface ViewTab {
  id: string
  label: string
  element: ReactNode
}

export function TabbedView({ tabs, ariaLabel }: { tabs: ViewTab[]; ariaLabel: string }) {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const active = tabs.find((t) => t.id === requested) ?? tabs[0]

  const onChange = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next, { replace: true })
  }

  return (
    <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Tabs
        value={active.id}
        onChange={(_, v) => onChange(v)}
        aria-label={ariaLabel}
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40, flexShrink: 0 }}
      >
        {tabs.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} sx={{ minHeight: 40 }} />
        ))}
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Suspense fallback={null}>{active.element}</Suspense>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/TabbedView.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TabbedView.tsx frontend/src/components/TabbedView.test.tsx
git commit -m "feat(nav): generic TabbedView container synced to ?tab="
```

---

### Task 3: Three container views (Review / Schedule / Automations)

**Files:**
- Create: `frontend/src/views/Review.tsx`
- Create: `frontend/src/views/Schedule.tsx`
- Create: `frontend/src/views/Automations.tsx`
- Test: `frontend/src/views/containers.test.tsx`

**Interfaces:**
- Consumes: `TabbedView`, `ViewTab` (Task 2); existing named exports `InboxView`, `ActionsView`, `DeadlinesView`, `CalendarView`, `SkillsView`, `ActivityView`.
- Produces: named exports `ReviewView`, `ScheduleView`, `AutomationsView`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/views/containers.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Stub the heavy child views so this test only proves tab wiring.
vi.mock('./Inbox', () => ({ InboxView: () => <div>INBOX VIEW</div> }))
vi.mock('./Actions', () => ({ ActionsView: () => <div>ACTIONS VIEW</div> }))
vi.mock('./Deadlines', () => ({ DeadlinesView: () => <div>DEADLINES VIEW</div> }))
vi.mock('./Calendar', () => ({ CalendarView: () => <div>CALENDAR VIEW</div> }))
vi.mock('./Skills', () => ({ SkillsView: () => <div>SKILLS VIEW</div> }))
vi.mock('./Activity', () => ({ ActivityView: () => <div>ACTIVITY VIEW</div> }))

import { ReviewView } from './Review'
import { ScheduleView } from './Schedule'
import { AutomationsView } from './Automations'

function wrap(node: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('container views', () => {
  it('Review shows Inbox + Actions tabs, Inbox default', async () => {
    wrap(<ReviewView />)
    expect(screen.getByRole('tab', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Actions' })).toBeInTheDocument()
    expect(await screen.findByText('INBOX VIEW')).toBeInTheDocument()
  })
  it('Schedule defaults to Deadlines and honors ?tab=calendar', async () => {
    wrap(<ScheduleView />, '/schedule?tab=calendar')
    expect(await screen.findByText('CALENDAR VIEW')).toBeInTheDocument()
  })
  it('Automations shows Skills + Activity tabs', () => {
    wrap(<AutomationsView />)
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/containers.test.tsx`
Expected: FAIL — cannot resolve `./Review`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/views/Review.tsx
import { lazy } from 'react'
import { TabbedView } from '@/components/TabbedView'

const InboxView = lazy(() => import('./Inbox').then((m) => ({ default: m.InboxView })))
const ActionsView = lazy(() => import('./Actions').then((m) => ({ default: m.ActionsView })))

export function ReviewView() {
  return (
    <TabbedView
      ariaLabel="Review sections"
      tabs={[
        { id: 'inbox', label: 'Inbox', element: <InboxView /> },
        { id: 'actions', label: 'Actions', element: <ActionsView /> },
      ]}
    />
  )
}
```

```tsx
// frontend/src/views/Schedule.tsx
import { lazy } from 'react'
import { TabbedView } from '@/components/TabbedView'

const DeadlinesView = lazy(() => import('./Deadlines').then((m) => ({ default: m.DeadlinesView })))
const CalendarView = lazy(() => import('./Calendar').then((m) => ({ default: m.CalendarView })))

export function ScheduleView() {
  return (
    <TabbedView
      ariaLabel="Schedule sections"
      tabs={[
        { id: 'deadlines', label: 'Deadlines', element: <DeadlinesView /> },
        { id: 'calendar', label: 'Calendar', element: <CalendarView /> },
      ]}
    />
  )
}
```

```tsx
// frontend/src/views/Automations.tsx
import { lazy } from 'react'
import { TabbedView } from '@/components/TabbedView'

const SkillsView = lazy(() => import('./Skills').then((m) => ({ default: m.SkillsView })))
const ActivityView = lazy(() => import('./Activity').then((m) => ({ default: m.ActivityView })))

export function AutomationsView() {
  return (
    <TabbedView
      ariaLabel="Automations sections"
      tabs={[
        { id: 'skills', label: 'Skills', element: <SkillsView /> },
        { id: 'activity', label: 'Activity', element: <ActivityView /> },
      ]}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/views/containers.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Review.tsx frontend/src/views/Schedule.tsx frontend/src/views/Automations.tsx frontend/src/views/containers.test.tsx
git commit -m "feat(nav): Review/Schedule/Automations tab containers over existing views"
```

---

### Task 4: Wire routes + redirects in `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx` (imports block ~lines 14-25; routes block ~lines 99-114; `onViewChange` prop ~line 66)
- Modify: `frontend/src/App.routes.test.tsx`

**Interfaces:**
- Consumes: `ReviewView`, `ScheduleView`, `AutomationsView` (Task 3).
- Produces: `onViewChange` now receives a full path string; `CommandPalette` (Task 6) must call it with a path.

- [ ] **Step 1: Update the route test first (failing)**

Replace the body of `frontend/src/App.routes.test.tsx`'s `describe('routing', …)` with:

```tsx
describe('routing', () => {
  it('renders grouped sidebar nav links from the registry', async () => {
    renderAt('/')
    const link = await screen.findByRole('link', { name: /review/i })
    expect(link).toHaveAttribute('href', '/review')
  })

  it('marks the active route with aria-current', async () => {
    renderAt('/settings')
    const link = await screen.findByRole('link', { name: /settings/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('redirects legacy /inbox to /review', async () => {
    renderAt('/inbox')
    // Review mounts the Inbox tab; the Review sidebar link is marked active
    const link = await screen.findByRole('link', { name: /review/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('redirects legacy /deadlines to /schedule', async () => {
    renderAt('/deadlines')
    const link = await screen.findByRole('link', { name: /schedule/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.routes.test.tsx`
Expected: FAIL — no `/review` link (sidebar still old) / no redirect.

- [ ] **Step 3: Edit `App.tsx` imports**

Remove the standalone lazy imports for views now nested in containers, and add the container imports. The imports block becomes:

```tsx
// Lazy-loaded views with named export conversion to default
const DashboardView = lazy(() => import('@/views/Dashboard').then(m => ({ default: m.DashboardView })))
const DataFeedView = lazy(() => import('@/views/DataFeed').then(m => ({ default: m.DataFeedView })))
const SettingsView = lazy(() => import('@/views/Settings').then(m => ({ default: m.SettingsView })))
const TasksView = lazy(() => import('@/views/Tasks').then(m => ({ default: m.TasksView })))
const PeopleView = lazy(() => import('@/views/People').then(m => ({ default: m.PeopleView })))
const ReviewView = lazy(() => import('@/views/Review').then(m => ({ default: m.ReviewView })))
const ScheduleView = lazy(() => import('@/views/Schedule').then(m => ({ default: m.ScheduleView })))
const AutomationsView = lazy(() => import('@/views/Automations').then(m => ({ default: m.AutomationsView })))
```

(Deleted: standalone `DeadlinesView`, `InboxView`, `CalendarView`, `ActionsView`, `SkillsView`, `ActivityView` imports — they now load inside the containers.)

- [ ] **Step 4: Edit the `<Routes>` block**

```tsx
<Routes>
  <Route path="/" element={<DashboardView />} />
  <Route path="/review" element={<ReviewView />} />
  <Route path="/tasks" element={<TasksView />} />
  <Route path="/schedule" element={<ScheduleView />} />
  <Route path="/feed" element={<DataFeedView />} />
  <Route path="/people" element={<PeopleView />} />
  <Route path="/automations" element={<AutomationsView />} />
  <Route path="/settings" element={<SettingsView />} />

  {/* legacy redirects — preserve bookmarks + ⌘K deep links */}
  <Route path="/inbox" element={<Navigate to="/review" replace />} />
  <Route path="/actions" element={<Navigate to="/review?tab=actions" replace />} />
  <Route path="/deadlines" element={<Navigate to="/schedule" replace />} />
  <Route path="/calendar" element={<Navigate to="/schedule?tab=calendar" replace />} />
  <Route path="/skills" element={<Navigate to="/automations" replace />} />
  <Route path="/activity" element={<Navigate to="/automations?tab=activity" replace />} />
  <Route path="/trending" element={<Navigate to="/feed?view=trending" replace />} />
  <Route path="/topics" element={<Navigate to="/feed?view=topics" replace />} />
  <Route path="/docs" element={<Navigate to="/automations" replace />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

- [ ] **Step 5: Simplify `onViewChange` to path-based**

Change the `CommandPalette` prop from:

```tsx
onViewChange={(id) => navigate(id === 'dashboard' ? '/' : '/' + id)}
```

to:

```tsx
onViewChange={(path) => navigate(path)}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/App.routes.test.tsx`
Expected: PASS (4 tests). NOTE: this depends on Task 5 (Sidebar reading the registry) for the `/review` and `/schedule` links to exist. If running strictly task-by-task, expect the two redirect tests to stay red until Task 5 lands — that is acceptable; re-run at end of Task 5.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.routes.test.tsx
git commit -m "feat(nav): mount tab containers, redirect legacy routes, path-based nav"
```

---

### Task 5: Sidebar renders grouped registry

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx` (replace `SIDEBAR_ITEMS` const + the map body)
- Modify: `frontend/src/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `NAV`, `NAV_GROUPS` (Task 1).
- Produces: sidebar links keyed by `NavItem.path`; group subheaders shown only when expanded.

- [ ] **Step 1: Update Sidebar test first (failing)**

Replace `frontend/src/components/Sidebar.test.tsx` body with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

function wrap(collapsed: boolean, onToggle = vi.fn()) {
  return render(
    <MemoryRouter>
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  it('hides text labels when collapsed but keeps accessible links', () => {
    wrap(true)
    expect(screen.queryByText('Home')).toBeNull()
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
  })

  it('shows the 8 registry labels and group headers when expanded', () => {
    wrap(false)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toBeInTheDocument()
    // group header
    expect(screen.getByText('Knowledge')).toBeInTheDocument()
  })

  it('renders review link pointing at /review', () => {
    wrap(false)
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute('href', '/review')
  })

  it('toggle button calls onToggle with negated value', () => {
    const onToggle = vi.fn()
    wrap(false, onToggle)
    fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/Sidebar.test.tsx`
Expected: FAIL — no "Home"/"Knowledge" text (still old items).

- [ ] **Step 3: Edit `Sidebar.tsx`**

Replace the icon imports + `SIDEBAR_ITEMS` const with a registry import, and render grouped. Full new file:

```tsx
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Menu } from 'lucide-react'
import { NAV, NAV_GROUPS } from '@/nav'
import { HelpDialog } from './HelpDialog'

interface SidebarProps {
  collapsed: boolean
  onToggle: (collapsed: boolean) => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: collapsed ? 56 : 200,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        transition: 'width 0.2s',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 1 }}>
        <IconButton onClick={() => onToggle(!collapsed)} aria-label="Toggle sidebar" color="primary">
          <Menu size={20} />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.5, py: 1.5, px: collapsed ? 0 : 1 }}>
        {NAV_GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group.id)
          if (items.length === 0) return null
          return (
            <Box key={group.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
              {!collapsed && (
                <Typography variant="caption" color="text.disabled" sx={{ px: 1, pt: 1, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 10 }}>
                  {group.label}
                </Typography>
              )}
              {items.map((item) => {
                const content = (
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    aria-label={item.label}
                    style={{ position: 'relative', textDecoration: 'none' }}
                  >
                    {({ isActive }) => (
                      <Box
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          borderRadius: 1, px: collapsed ? 0 : 1, py: 0.5,
                          color: isActive ? 'primary.main' : 'text.secondary',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <IconButton component="span" color={isActive ? 'primary' : 'default'} aria-hidden sx={{ p: collapsed ? 1 : 0.5 }}>
                          <item.icon size={20} />
                        </IconButton>
                        {!collapsed && (
                          <Typography variant="body2" sx={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</Typography>
                        )}
                        {isActive && (
                          <Box sx={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 24, bgcolor: 'primary.main', borderRadius: '0 3px 3px 0' }} />
                        )}
                      </Box>
                    )}
                  </NavLink>
                )
                return collapsed ? (
                  <Tooltip key={item.id} title={item.label} placement="right">{content}</Tooltip>
                ) : (
                  <Box key={item.id}>{content}</Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
      <Box sx={{ minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 1, borderTop: 1, borderColor: 'divider' }}>
        <Tooltip title="Help" placement="right">
          <IconButton aria-label="Help" size="small" onClick={() => setHelpOpen(true)}>?</IconButton>
        </Tooltip>
        {!collapsed && <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Help</Typography>}
      </Box>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/Sidebar.test.tsx src/App.routes.test.tsx`
Expected: PASS (Sidebar 4 tests + App.routes 4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.test.tsx
git commit -m "feat(nav): grouped 8-item sidebar from route registry"
```

---

### Task 6: CommandPalette navigates by registry path

**Files:**
- Modify: `frontend/src/components/CommandPalette.tsx` (`VIEWS` const, `KIND_VIEW` map, nav `onSelect`, quick-action `onSelect`)
- Modify: `frontend/src/components/CommandPalette.test.tsx` and `frontend/src/components/CommandPalette.actions.test.tsx` if they assert old ids

**Interfaces:**
- Consumes: `NAV` (Task 1); `onViewChange(path: string)` (Task 4).
- Produces: palette nav + entity + quick-action selections all call `onViewChange` with a full path.

- [ ] **Step 1: Inspect current palette tests for id assumptions**

Run: `cd frontend && npx vitest run src/components/CommandPalette.test.tsx src/components/CommandPalette.actions.test.tsx`
Expected: PASS now (baseline). Note any assertion that expects `onViewChange` called with a bare id (e.g. `'inbox'`, `'tasks'`) — those must change to paths in Step 4.

- [ ] **Step 2: Write/adjust the failing test**

Add to `frontend/src/components/CommandPalette.test.tsx` (inside its top `describe`):

```tsx
it('navigates to a registry path when a nav item is chosen', async () => {
  const onViewChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CommandPalette open onOpenChange={() => {}} onViewChange={onViewChange} onRefresh={() => {}} />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByText('Review'))
  expect(onViewChange).toHaveBeenCalledWith('/review')
})
```

(Ensure `vi`, `fireEvent`, `QueryClient`, `QueryClientProvider` are imported in that test file; add any missing import.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CommandPalette.test.tsx`
Expected: FAIL — palette still lists old label "Inbox" and calls with id, no "Review".

- [ ] **Step 4: Edit `CommandPalette.tsx`**

Replace the hardcoded `VIEWS` const with a registry-derived list, and switch `KIND_VIEW` + quick actions to paths:

```tsx
import { NAV } from '@/nav'

// nav destinations, derived from the single route registry
const VIEWS = NAV.map((n) => ({ path: n.path, label: n.label }))

// Result entity kind -> section heading + the PATH to navigate to.
const KIND_ORDER = ['task', 'signal', 'deadline', 'event', 'person', 'topic', 'trend'] as const
const KIND_LABEL: Record<string, string> = {
  task: 'Tasks', signal: 'Signals', deadline: 'Deadlines', event: 'Events',
  person: 'People', topic: 'Topics', trend: 'Trends',
}
const KIND_VIEW: Record<string, string> = {
  task: '/tasks', signal: '/review', deadline: '/schedule', event: '/schedule?tab=calendar',
  person: '/people', topic: '/feed?view=topics', trend: '/feed?view=trending',
}
```

Update the entity result `onSelect` (already `onViewChange(KIND_VIEW[kind])` — now a path, no change needed).

Update the navigation group to key/select by path:

```tsx
{filteredViews.map((view) => (
  <Command.Item
    key={view.path}
    value={`nav-${view.path}`}
    style={itemStyle}
    onMouseEnter={hoverOn}
    onMouseLeave={hoverOff}
    onSelect={() => { onViewChange(view.path); close() }}
  >
    {view.label}
  </Command.Item>
))}
```

Update the quick actions to paths:

```tsx
<Command.Item value="add-deadline" style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
  onSelect={() => { onViewChange('/schedule'); close() }}>
  Add deadline
</Command.Item>
<Command.Item value="go-to-review" style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
  onSelect={() => { onViewChange('/review?tab=actions'); close() }}>
  Go to Review
</Command.Item>
<Command.Item value="refresh" style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
  onSelect={() => { onRefresh(); close() }}>
  Refresh data
</Command.Item>
```

Also update `navMatch`/`filteredViews` to filter on `.label` (already does — `VIEWS.filter((v) => navMatch(v.label))` still valid).

- [ ] **Step 5: Fix any legacy id assertions**

In `CommandPalette.test.tsx` / `CommandPalette.actions.test.tsx`, replace any `expect(onViewChange).toHaveBeenCalledWith('inbox')`-style assertions with the new path (e.g. `'/review'`), and any `getByText('Inbox')` nav-label lookups with `'Review'` where they referred to the removed nav item.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/CommandPalette.test.tsx src/components/CommandPalette.actions.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full suite + build**

Run: `cd frontend && npm test && npm run build`
Expected: all tests green; production build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CommandPalette.tsx frontend/src/components/CommandPalette.test.tsx frontend/src/components/CommandPalette.actions.test.tsx
git commit -m "feat(nav): command palette navigates by route registry paths"
```

---

## Watch-items (carry to SP-2/3/4)

- Tabbed containers add a ~40px tab strip above views that assume full `calc(100vh - 48px)` height; nested scroll is handled by `TabbedView`'s overflow wrapper, but a view with its own `100vh` math may show a minor inner scrollbar. Cosmetic — SP-2/3/4 flatten each container into a true unified view.
- Widget `drillDown` targets (`/deadlines`, `/inbox`, `/calendar`, `/trending`) still point at legacy paths; they work via redirect. Update to canonical paths during SP-1 (registry unification).
- `Quickdraw` "Review in Actions" button navigates to `/actions` (redirects to `/review?tab=actions`) — works; retarget in SP-3.

## Self-Review

- **Spec coverage:** Target nav 8 grouped (Task 1+5 ✓); registry single source drives Sidebar+Palette+Routes (Tasks 1,4,5,6 ✓); merges as tab containers (Task 3 ✓); redirects preserve deep links incl. `/docs` deletion→`/automations` (Task 4 ✓); frontend-only, no view edits (Global Constraints ✓). Registry-unify aggregators = SP-1, out of scope here (noted in watch-items).
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `NavItem`/`NAV`/`NAV_GROUPS` (Task 1) consumed verbatim in Tasks 5,6; `ViewTab`/`TabbedView` (Task 2) consumed in Task 3; `onViewChange(path)` contract set in Task 4, honored in Task 6.
