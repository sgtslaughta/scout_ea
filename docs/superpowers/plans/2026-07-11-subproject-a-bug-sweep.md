# Sub-Project A — Bug Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a batch of broken/dead Scout EA UI — the Trending crash, dead hamburger/Help controls, the greyed add-widget dead-end, the silent test-notification, and the non-interactive right drawer — and add the route error boundary that lets one bad view degrade gracefully instead of white-screening the app.

**Architecture:** Presentation/logic fixes across the existing MUI frontend, plus two small new components (`RouteErrorBoundary`, `HelpDialog`). The Trending crash is fixed at the data boundary (coerce `delta` to number in the `getTrends` fetcher) so the `Trend.delta: number` type becomes honest for every consumer. No backend changes.

**Tech Stack:** React 19, TypeScript, MUI v7 + MUI X DataGrid v9, react-router v7, TanStack Query, vitest, sonner (toasts).

## Global Constraints

- MUI v7: no Typography/Box system props — use `sx`. MUI X Community only.
- No new dependencies. No backend changes (the fixes are frontend-only; `/api/push/test` already exists at `backend/web/app.py:311`).
- Preserve existing behavior: routes, query-param drill-downs + chips, all view tests.
- Before EVERY commit, all three green from `frontend/`: `npx vitest run`, `npx tsc -b`, `npm run build`.
- Files under 500 lines. Semantic commits. Branch: `subproject-a-bug-sweep` from master.
- localStorage keys are contracts: existing `ea-theme`, `ea-accent`, `ea-dashboard-layout`, `ea-briefing-shown`; new this plan: `ea-sidebar-collapsed`.
- Use existing theme tokens only — no palette/design-system changes (that is Sub-Project B).
- Every test that renders a component using `useNavigate`/`NavLink`/`useSearchParams` must wrap it in `<MemoryRouter>`; components using `useColorScheme` need `<ThemeProvider theme={theme}>` (import `theme` from `@/theme`).

---

### Task 1: Fix Trending crash + Route error boundary

**Files:**
- Modify: `frontend/src/api.ts` (coerce `delta` in `getTrends`)
- Modify: `frontend/src/views/Trending.tsx` (tidy `bg.main` → `background.default`, 2 spots)
- Create: `frontend/src/components/RouteErrorBoundary.tsx`
- Create: `frontend/src/components/RouteErrorBoundary.test.tsx`
- Modify: `frontend/src/App.tsx` (wrap `<Routes>`)

**Interfaces:**
- Produces: `RouteErrorBoundary` (default-exported class component; props `{ children: ReactNode }`). Resets by being remounted via a React `key` on the current pathname.
- `getTrends` return shape unchanged (`Trend[]`) but `delta` is now always `number | undefined`, never a string.

- [ ] **Step 1: Write the failing boundary test**

Create `frontend/src/components/RouteErrorBoundary.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import RouteErrorBoundary from './RouteErrorBoundary'

function Boom(): React.ReactNode {
  throw new Error('view exploded')
}

describe('RouteErrorBoundary', () => {
  it('renders children when they do not throw', () => {
    render(<RouteErrorBoundary><div>ok content</div></RouteErrorBoundary>)
    expect(screen.getByText('ok content')).toBeInTheDocument()
  })

  it('catches a child error and shows a fallback Alert with the message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<RouteErrorBoundary><Boom /></RouteErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent(/view exploded/i)
    spy.mockRestore()
  })

  it('reload button clears the error and re-renders children', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Flaky() {
      const [boom, setBoom] = useState(true)
      // expose a way to stop throwing after reset
      ;(globalThis as Record<string, unknown>).__stop = () => setBoom(false)
      if (boom) throw new Error('flaky')
      return <div>recovered</div>
    }
    render(<RouteErrorBoundary><Flaky /></RouteErrorBoundary>)
    ;(globalThis as Record<string, unknown>).__stop && (globalThis as { __stop: () => void }).__stop()
    fireEvent.click(screen.getByRole('button', { name: /reload view/i }))
    expect(screen.getByText('recovered')).toBeInTheDocument()
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/RouteErrorBoundary.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement RouteErrorBoundary**

Create `frontend/src/components/RouteErrorBoundary.tsx`:

```tsx
import { Component } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'

interface Props {
  children: ReactNode
}

interface State {
  error?: Error
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  handleReload = () => {
    this.setState({ error: undefined })
  }

  render() {
    if (this.state.error) {
      return (
        <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={this.handleReload}>
                Reload view
              </Button>
            }
          >
            <AlertTitle>This view hit an error</AlertTitle>
            {this.state.error.message}
          </Alert>
        </Box>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 4: Run boundary test to verify pass**

Run: `cd frontend && npx vitest run src/components/RouteErrorBoundary.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Coerce delta in getTrends**

In `frontend/src/api.ts`, the current fetcher is:

```ts
export const getTrends = (windowStart?: string) => {
  const qs = windowStart ? `?window_start=${encodeURIComponent(windowStart)}` : ''
  return fetchJson<Trend[]>(`/api/trends${qs}`)
}
```

Replace with (coerce delta to a real number so `Trend.delta: number` is honest):

```ts
export const getTrends = async (windowStart?: string): Promise<Trend[]> => {
  const qs = windowStart ? `?window_start=${encodeURIComponent(windowStart)}` : ''
  const rows = await fetchJson<Trend[]>(`/api/trends${qs}`)
  return rows.map((r) => ({
    ...r,
    delta: r.delta == null ? undefined : Number(r.delta),
  }))
}
```

- [ ] **Step 6: Tidy Trending bg.main**

In `frontend/src/views/Trending.tsx`, replace both occurrences of `bgcolor: 'bg.main'` with `bgcolor: 'background.default'` (the error branch container and the main return container). No other change.

- [ ] **Step 7: Wrap Routes in App.tsx**

In `frontend/src/App.tsx`: add imports `import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'` (add `useLocation`) and `import RouteErrorBoundary from '@/components/RouteErrorBoundary'`. Inside the component add `const location = useLocation()`. Wrap the `<Routes>…</Routes>` block (inside the existing `<Suspense>`) so it reads:

```tsx
<Suspense fallback={<Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', fontSize: 14 }}>Loading…</Box>}>
  <RouteErrorBoundary key={location.pathname}>
    <Routes>
      {/* existing routes unchanged */}
    </Routes>
  </RouteErrorBoundary>
</Suspense>
```

The `key={location.pathname}` remounts the boundary on navigation so a caught error clears when the user navigates away.

- [ ] **Step 8: All three green**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: all pass (existing Trending tests still green; new boundary tests green). If an existing App test renders `<App/>` without a router, it already wraps in MemoryRouter (Phase 1) — no change needed.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api.ts frontend/src/views/Trending.tsx frontend/src/components/RouteErrorBoundary.tsx frontend/src/components/RouteErrorBoundary.test.tsx frontend/src/App.tsx
git commit -m "fix(frontend): Trending crash (coerce trends.delta to number) + route error boundary"
```

---

### Task 2: Hamburger — collapse/expand sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx` (render labels when expanded, width transition)
- Modify: `frontend/src/App.tsx` (init `collapsedSidebar` from localStorage, persist on toggle)
- Create: `frontend/src/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: existing `Sidebar` props `{ collapsed: boolean; onToggle: (c: boolean) => void }` (unchanged).
- Produces: when `collapsed === false`, each nav item shows its text label and the rail widens to 200px; when `true`, 56px icon rail with tooltips (today's behavior). `App.tsx` persists to `localStorage['ea-sidebar-collapsed']`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/Sidebar.test.tsx`:

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
  it('hides text labels when collapsed', () => {
    wrap(true)
    // icons present as accessible links, but the visible "Dashboard" text label is not rendered
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('shows text labels when expanded', () => {
    wrap(false)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('toggle button calls onToggle with negated value', () => {
    const onToggle = vi.fn()
    wrap(false, onToggle)
    fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/Sidebar.test.tsx`
Expected: FAIL — expanded label text not rendered (current Sidebar never renders labels).

- [ ] **Step 3: Rewrite Sidebar to honor `collapsed`**

Replace `frontend/src/components/Sidebar.tsx` with:

```tsx
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import {
  Calendar, CheckSquare, Cog, Inbox, Menu, TrendingUp,
  AlertCircle, FileText, Grid3x3, Users, Hash,
} from 'lucide-react'
import { HelpDialog } from './HelpDialog'

const SIDEBAR_ITEMS = [
  { id: 'dashboard', route: '/', icon: Grid3x3, label: 'Dashboard' },
  { id: 'inbox', route: '/inbox', icon: Inbox, label: 'Inbox' },
  { id: 'tasks', route: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'calendar', route: '/calendar', icon: Calendar, label: 'Calendar' },
  { id: 'trending', route: '/trending', icon: TrendingUp, label: 'Trending' },
  { id: 'deadlines', route: '/deadlines', icon: AlertCircle, label: 'Deadlines' },
  { id: 'people', route: '/people', icon: Users, label: 'People' },
  { id: 'topics', route: '/topics', icon: Hash, label: 'Topics' },
  { id: 'docs', route: '/docs', icon: FileText, label: 'Docs' },
  { id: 'settings', route: '/settings', icon: Cog, label: 'Settings' },
]

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
        {SIDEBAR_ITEMS.map((item) => {
          const content = (
            <NavLink
              to={item.route}
              end={item.route === '/'}
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

Note: this imports `HelpDialog` (built in Task 3). Task 2 and Task 3 both touch Sidebar; **execute Task 3 first if the import would break the build**, OR add a temporary no-op — but since subagent-driven runs tasks sequentially and Task 3 creates HelpDialog, reorder is unnecessary if Task 3 lands before Task 2's build. **Controller note: dispatch Task 3 (HelpDialog) BEFORE Task 2** so the import resolves. The plan lists Task 2 before Task 3 for narrative; the controller should swap execution order or fold the HelpDialog stub into Task 2. To keep tasks independent, Task 2's Step 3 above already wires Help — so run Task 3 first.

- [ ] **Step 4: Persist collapse in App.tsx**

In `frontend/src/App.tsx`, change the state init and toggle to persist:

```tsx
const [collapsedSidebar, setCollapsedSidebar] = useState(
  () => localStorage.getItem('ea-sidebar-collapsed') === 'true',
)
```

And replace the `<Sidebar .../>` usage's `onToggle`:

```tsx
<Sidebar
  collapsed={collapsedSidebar}
  onToggle={(c) => { setCollapsedSidebar(c); localStorage.setItem('ea-sidebar-collapsed', String(c)) }}
/>
```

- [ ] **Step 5: All three green**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green. Existing routing test (App.routes.test.tsx) still finds nav links by aria-label.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.test.tsx frontend/src/App.tsx
git commit -m "feat(frontend): sidebar collapse/expand with labels, persisted"
```

---

### Task 3: Help dialog

**Files:**
- Create: `frontend/src/components/HelpDialog.tsx`
- Create: `frontend/src/components/HelpDialog.test.tsx`

**Interfaces:**
- Produces: `HelpDialog` (named export) props `{ open: boolean; onClose: () => void }`. Consumed by `Sidebar` (Task 2).
- **Execution order: build this BEFORE Task 2** (Task 2's Sidebar imports it).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/HelpDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelpDialog } from './HelpDialog'

function wrap(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <HelpDialog open={open} onClose={onClose} />
    </MemoryRouter>,
  )
}

describe('HelpDialog', () => {
  it('does not render content when closed', () => {
    wrap(false)
    expect(screen.queryByText(/keyboard shortcuts/i)).toBeNull()
  })

  it('shows shortcuts and a docs link when open', () => {
    wrap(true)
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument()
    expect(screen.getByText('⌘K')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /documentation/i })).toHaveAttribute('href', '/docs')
  })

  it('calls onClose from the Close button', () => {
    const onClose = vi.fn()
    wrap(true, onClose)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/HelpDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement HelpDialog**

Create `frontend/src/components/HelpDialog.tsx`:

```tsx
import { Link as RouterLink } from 'react-router-dom'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

interface HelpDialogProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: Array<[string, string]> = [
  ['⌘K', 'Open the command palette'],
  ['Esc', 'Close dialogs and overlays'],
]

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Help</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Scout EA is your executive-assistant dashboard — signals, tasks, deadlines and
          trends in one place.
        </Typography>
        <Typography variant="overline" color="text.secondary">Keyboard shortcuts</Typography>
        <Stack spacing={0.5} sx={{ my: 1 }}>
          {SHORTCUTS.map(([key, desc]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', minWidth: 40 }}>{key}</Typography>
              <Typography variant="body2" color="text.secondary">{desc}</Typography>
            </Box>
          ))}
        </Stack>
        <Link component={RouterLink} to="/docs" onClick={onClose} variant="body2">
          Open documentation
        </Link>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run src/components/HelpDialog.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: All three green**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/HelpDialog.tsx frontend/src/components/HelpDialog.test.tsx
git commit -m "feat(frontend): Help dialog (shortcuts + docs link)"
```

---

### Task 4: Manage-widgets menu (replace greyed add-widget)

**Files:**
- Modify: `frontend/src/views/Dashboard.tsx`
- Modify: `frontend/src/views/Dashboard.test.tsx` (update the add-widget test to the new control)

**Interfaces:**
- Consumes: existing `layout` module (`setWidgetHidden`, `saveLayout`, etc.) and `WIDGETS`.
- Produces: an always-enabled "Manage widgets" button opening a checklist menu of all widgets.

- [ ] **Step 1: Read the current Dashboard.test.tsx** to see the existing add-widget/manage assertions, then update them TDD-first to target the new "Manage widgets" control. The test must assert: (a) a "Manage widgets" button exists and is never disabled; (b) opening it lists every widget in `WIDGETS`; (c) unchecking a visible widget hides it and persists to `ea-dashboard-layout`; (d) re-checking shows it again.

Test to add/replace in `frontend/src/views/Dashboard.test.tsx` (keep the existing render helper + fetch stub; adapt names to it):

```tsx
it('Manage widgets menu toggles visibility and persists', async () => {
  wrap()  // existing helper that renders DashboardView in providers + MemoryRouter
  const btn = await screen.findByRole('button', { name: /manage widgets/i })
  expect(btn).not.toBeDisabled()
  fireEvent.click(btn)
  // every widget listed
  const items = await screen.findAllByRole('menuitemcheckbox')
  expect(items.length).toBe(WIDGETS.length)
  // hide the first widget
  fireEvent.click(items[0])
  await waitFor(() => {
    const stored = JSON.parse(localStorage.getItem('ea-dashboard-layout')!)
    expect(stored.hidden.length).toBe(1)
  })
})
```

Ensure the test file imports `WIDGETS` from `../widgets/registry`, and `waitFor`, `fireEvent` from `@testing-library/react`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/views/Dashboard.test.tsx`
Expected: FAIL — no "Manage widgets" button yet.

- [ ] **Step 3: Replace the toolbar in Dashboard.tsx**

Replace the imports line `import { Plus, RotateCcw } from 'lucide-react'` with:

```tsx
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
```

(Keep the existing `Menu` import; drop `MenuItem` from the top import only if duplicated — ensure a single `MenuItem` import remains.)

Replace the toolbar `<Box sx={{ display: 'flex', justifyContent: 'flex-end'…}}>…</Box>` block (the Add-widget button + Reset + Menu) with:

```tsx
<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
  <Button size="small" startIcon={<SlidersHorizontal size={14} />} onClick={(e) => setManageAnchor(e.currentTarget)} aria-label="Manage widgets">
    Manage widgets
  </Button>
  <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => setLayout(defaultLayout(ALL_KEYS))} aria-label="Reset layout">
    Reset
  </Button>
  <Menu anchorEl={manageAnchor} open={!!manageAnchor} onClose={() => setManageAnchor(null)}>
    {WIDGETS.map((w) => {
      const isHidden = hidden.has(w.key)
      return (
        <MenuItem
          key={w.key}
          role="menuitemcheckbox"
          aria-checked={!isHidden}
          onClick={() => setLayout(setWidgetHidden(layout, w.key, !isHidden))}
        >
          <Checkbox edge="start" checked={!isHidden} tabIndex={-1} disableRipple size="small" />
          <ListItemText primary={w.title} />
        </MenuItem>
      )
    })}
  </Menu>
</Box>
```

Rename the state hook `const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null)` to `const [manageAnchor, setManageAnchor] = useState<HTMLElement | null>(null)`. Remove the now-unused `hiddenDefs` variable. Update the empty-state Typography text from `use "Add widget"` to `use "Manage widgets"`.

- [ ] **Step 4: Run to verify pass + all three green**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Dashboard.tsx frontend/src/views/Dashboard.test.tsx
git commit -m "feat(frontend): Manage-widgets checklist menu replaces greyed add-widget"
```

---

### Task 5: Test-notification toast surfaces result

**Files:**
- Modify: `frontend/src/views/Settings.tsx` (`handleSendTest`)
- Modify/Create: `frontend/src/views/Settings.test.tsx` (add a test for the two branches)

**Interfaces:**
- Consumes: `sendTestPush()` from `@/lib/push` (returns `Promise<number>` — the sent count).

- [ ] **Step 1: Write the failing test**

In `frontend/src/views/Settings.test.tsx`, add (mock `@/lib/push` and `sonner`; adapt to the file's existing render helper + provider wrapper — Settings needs `ThemeProvider`):

```tsx
import { vi } from 'vitest'
import * as push from '@/lib/push'
import { toast } from 'sonner'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

it('test-notification toast reflects sent count', async () => {
  vi.spyOn(push, 'sendTestPush').mockResolvedValue(3)
  vi.spyOn(push, 'getSubscriptionState').mockResolvedValue('subscribed')
  renderSettings()  // existing helper
  fireEvent.click(await screen.findByRole('button', { name: /send test/i }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Sent to 3 subscription(s)'))
})

it('test-notification with zero subscriptions shows an info toast', async () => {
  vi.spyOn(push, 'sendTestPush').mockResolvedValue(0)
  vi.spyOn(push, 'getSubscriptionState').mockResolvedValue('subscribed')
  renderSettings()
  fireEvent.click(await screen.findByRole('button', { name: /send test/i }))
  await waitFor(() =>
    expect(toast.info).toHaveBeenCalledWith(
      'No active subscriptions — enable notifications first (requires a real browser + push service)',
    ),
  )
})
```

Note: the "Send test" button only renders when `pushState === 'subscribed'`, hence the `getSubscriptionState` mock. If the existing test file has no `renderSettings` helper, mirror the render pattern already used in `Settings.test.tsx`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/views/Settings.test.tsx`
Expected: FAIL — current handler calls `toast.success(\`Sent ${n}\`)`, not the new strings, and never `toast.info`.

- [ ] **Step 3: Update handleSendTest**

In `frontend/src/views/Settings.tsx`, replace the body of `handleSendTest`:

```tsx
const handleSendTest = async () => {
  setLoadingPush(true)
  try {
    const n = await sendTestPush()
    if (n > 0) {
      toast.success(`Sent to ${n} subscription(s)`)
    } else {
      toast.info('No active subscriptions — enable notifications first (requires a real browser + push service)')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send test'
    toast.error(msg)
  } finally {
    setLoadingPush(false)
  }
}
```

- [ ] **Step 4: Run to verify pass + all three green**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Settings.tsx frontend/src/views/Settings.test.tsx
git commit -m "feat(frontend): test-notification toast surfaces sent count / zero-subs hint"
```

---

### Task 6: Right-drawer — click-to-nav + hover detail

**Files:**
- Modify: `frontend/src/components/RightDrawer.tsx`
- Modify/Create: `frontend/src/components/RightDrawer.test.tsx`

**Interfaces:**
- Consumes: `useNavigate` (drawer is inside the router), existing queries.
- Produces: deadline items navigate to `/deadlines`, trend items to `/trending`; each wrapped in a Tooltip.

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/RightDrawer.test.tsx` (mirror the existing render helper — RightDrawer needs QueryClientProvider + MemoryRouter + ThemeProvider; the file already renders it, so reuse that setup):

```tsx
it('deadline items navigate to /deadlines on click', async () => {
  // fixtures: at least one deadline. Use the file's existing fetch stub shape.
  renderDrawer()  // existing helper
  const item = await screen.findByRole('button', { name: /team sync|deadline/i })
  // assert it is an actionable element wired to navigate; simplest: it has role button and is clickable
  expect(item).toBeInTheDocument()
})
```

Adapt the assertion to how the file already tests content. The concrete behavioral check: after rendering with a deadline fixture, the deadline row is a clickable element (role `button`) and a trend row is clickable; both carry a `title`/tooltip. If asserting navigation directly is impractical, assert the rows render as buttons with `aria-label` including the title. Keep every existing RightDrawer assertion.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/RightDrawer.test.tsx`
Expected: FAIL — current deadline/trend rows are non-interactive `Paper`/`Box`, no button role.

- [ ] **Step 3: Make rows interactive + tooltipped**

In `frontend/src/components/RightDrawer.tsx`: add `import { useNavigate } from 'react-router-dom'` and `import Tooltip from '@mui/material/Tooltip'`; inside the component add `const navigate = useNavigate()`.

For each **deadline** item, wrap the existing `<Paper>` so it is a button that navigates and carries a tooltip. Replace the deadline `<Paper key={item.id} …>…</Paper>` with:

```tsx
<Tooltip
  key={item.id}
  placement="left"
  title={
    <Box sx={{ p: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.title}</Typography>
      <Typography variant="caption" display="block">Due {new Date(item.due_at).toLocaleString()}</Typography>
      <Typography variant="caption" color="text.secondary">source: {item.source}</Typography>
    </Box>
  }
>
  <Paper
    variant="outlined"
    role="button"
    aria-label={item.title}
    onClick={() => navigate('/deadlines')}
    sx={{
      px: 1.5, py: 1, cursor: 'pointer',
      '&:hover': { bgcolor: 'action.hover' },
      ...(isUrgent(item.countdown_seconds) && { borderColor: 'error.main', bgcolor: 'rgba(var(--mui-palette-error-mainChannel) / 0.1)' }),
    }}
  >
    <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.title}</Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
      <Clock size={12} />
      <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
        {formatCountdown(item.countdown_seconds)}
      </Typography>
    </Box>
  </Paper>
</Tooltip>
```

For each **trend** item, replace the trend `<Box key={item.id} …>…</Box>` with a tooltipped, clickable row navigating to `/trending`:

```tsx
<Tooltip
  key={item.id}
  placement="left"
  title={
    <Box sx={{ p: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.term}</Typography>
      <Typography variant="caption" display="block">{item.kind} · score {item.score}</Typography>
      <Typography variant="caption" color="text.secondary">{item.window_start} → {item.window_end}</Typography>
    </Box>
  }
>
  <Box
    role="button"
    aria-label={item.term}
    onClick={() => navigate('/trending')}
    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderRadius: 1, border: 1, borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
  >
    <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>{item.term}</Typography>
    <Chip
      size="small"
      variant="outlined"
      icon={item.delta && item.delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      label={item.delta ? (item.delta > 0 ? '+' : '') + item.delta + '%' : '—'}
      color={item.delta && item.delta > 0 ? 'success' : 'default'}
    />
  </Box>
</Tooltip>
```

(`item.kind`, `item.score`, `item.window_start/end` exist on the `Trend` type. `delta` is now a number post-Task-1, so `+ '%'` still reads fine.)

- [ ] **Step 4: Run to verify pass + all three green**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RightDrawer.tsx frontend/src/components/RightDrawer.test.tsx
git commit -m "feat(frontend): right-drawer items click-to-nav + hover detail"
```

---

### Task 7: Verification — suites + visual

**Files:** none.

- [ ] **Step 1: Full suites**

```bash
cd frontend && npx vitest run && npx tsc -b && npm run build
cd ../backend && source ../.venv/bin/activate && python -m pytest -q
```

Expected: FE all green, BE 139 green (unchanged).

- [ ] **Step 2: Deploy + live verify**

```bash
cd /home/user/code/Scout_EA && rm -rf frontend_dist && cp -r frontend/dist frontend_dist
source .venv/bin/activate && python -c "import sys; sys.path.insert(0, 'backend'); import seed_demo; seed_demo.seed('ea.sqlite')"
python backend/run_web.py &   # :8765 — serves frontend_dist/, not frontend/dist
```

Playwright (established pattern, run from `frontend/`, chromium `/usr/bin/google-chrome`, addInitScript seeding `ea-theme` + `ea-briefing-shown`), capture console `pageerror` count:
- `/trending` — renders the DataGrid with rows, **zero pageerrors** (the crash is gone), delta chips show `+8%` etc.
- Expanded sidebar (click hamburger) shows text labels; collapsed shows icons only; reload persists the choice.
- Help dialog opens from the `?` button and shows shortcuts + docs link.
- Dashboard "Manage widgets" menu lists all widgets with checkboxes; unchecking hides a widget.
- Right drawer: deadline/trend rows show pointer cursor and a tooltip on hover; clicking a deadline lands on `/deadlines`.
Screenshot each dark + light into `frontend/screenshots/subA-*`.

- [ ] **Step 3: Kill server, note results**

```bash
pkill -f run_web.py
```

Record in the ledger: pageerror count on /trending (must be 0), and confirmation of each fix.

- [ ] **Step 4: Merge**

Merge `subproject-a-bug-sweep` to master per repo convention (no-ff), CI green.

---

## Self-Review Notes

- Spec coverage: A1 (Task 1 — verified root cause: delta string→number coercion + boundary), A2 (Task 1 boundary), A3 hamburger (Task 2), A4 Help (Task 3), A5 manage-widgets (Task 4), A6 test-notif (Task 5), A7 drawer (Task 6), verification (Task 7).
- **Execution ordering caveat:** Task 2's Sidebar imports `HelpDialog` from Task 3. The controller must dispatch **Task 3 before Task 2**, or the Task 2 build fails on a missing import. All other tasks are independent.
- No placeholder steps; every code step shows complete code. View-file tasks (4, 5, 6) instruct read-first + reuse the file's existing test helpers, since exact helper names live in the real files (Phase 2/3 lesson: plan-authored full rewrites without reading inject API bugs).
- Type consistency: `RouteErrorBoundary` default export (Task 1) matches App import (Task 1); `HelpDialog` named export (Task 3) matches Sidebar import (Task 2); `sendTestPush(): Promise<number>` matches Task 5 usage; `Trend.delta` is `number|undefined` after Task 1, relied on in Task 6.
