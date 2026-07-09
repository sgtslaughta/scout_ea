# Phase 1 — MUI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MUI v7 with a CSS-variables theme bridging the existing dark/light/accent system, add react-router with URL-based navigation, and rebuild the app shell (Sidebar, SignatureBar, RightDrawer, TodayBriefing) in MUI — leaving all 10 views untouched and working.

**Architecture:** MUI theme uses `cssVariables: {colorSchemeSelector: 'class'}` + `colorSchemes: {light, dark}` so MUI toggles the same `light`/`dark` class on `<html>` that the existing Tailwind tokens key off. `modeStorageKey="ea-theme"` reuses the existing localStorage key (values `dark|light|system` match MUI's). Accent personalization keeps writing `--color-accent` and additionally overrides `--mui-palette-primary-main`. react-router replaces the `useState` view switch; backend gets an SPA fallback so deep links survive refresh.

**Tech Stack:** React 19, Vite, TypeScript, MUI v7 (`@mui/material`, `@emotion/react`, `@emotion/styled`), react-router-dom v7, TanStack Query (unchanged), Tailwind v4 (stays for unmigrated views), vitest + testing-library, pytest (backend).

## Global Constraints

- MUI X Community/MIT only — never import from `-pro` packages.
- Tailwind tokens in `src/index.css` must keep working — 10 views still use them; do NOT remove Tailwind or any `--color-*` var.
- Files under 500 lines.
- Semantic commits (`feat:`, `refactor:`, `test:`, `fix:`).
- After every task: `cd frontend && npx vitest run` green. Before final commit: `npm run build` green, `cd backend && python -m pytest -q` green (CI runs both: `.github/workflows/ci.yml`).
- All commands run from repo root `/home/user/code/Scout_EA` unless stated.
- localStorage keys are fixed contracts: `ea-theme` (mode), `ea-accent` (accent color).

---

### Task 1: MUI dependencies + theme module

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/src/theme.ts`
- Create: `frontend/src/theme.test.ts`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Produces: `theme` (MUI Theme, default export pattern: named export), `applyAccent(color: string): void`, `loadAccent(): void`, `ACCENT_KEY = 'ea-accent'` from `@/theme`. ThemeProvider mounted in `main.tsx` with `modeStorageKey="ea-theme"`, `defaultMode="system"`.

- [ ] **Step 1: Install dependencies**

```bash
cd frontend && npm install @mui/material @emotion/react @emotion/styled react-router-dom
```

Expected: package.json gains the 4 deps, install succeeds.

- [ ] **Step 2: Write the failing test**

Create `frontend/src/theme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { theme, applyAccent, loadAccent, ACCENT_KEY } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.cssText = ''
  })

  it('has light and dark color schemes with brand palette', () => {
    expect(theme.colorSchemes.dark?.palette.primary.main).toBe('#F2A65A')
    expect(theme.colorSchemes.light?.palette.primary.main).toBe('#E67E22')
    expect(theme.colorSchemes.dark?.palette.background.default).toBe('#0B1220')
    expect(theme.colorSchemes.light?.palette.background.paper).toBe('#FFFFFF')
  })

  it('uses class-based color scheme selector (matches Tailwind tokens)', () => {
    expect(theme.cssVariables).toMatchObject({ colorSchemeSelector: 'class' })
  })

  it('applyAccent persists and sets both CSS var systems', () => {
    applyAccent('#FF0000')
    expect(localStorage.getItem(ACCENT_KEY)).toBe('#FF0000')
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#FF0000')
    expect(document.documentElement.style.getPropertyValue('--mui-palette-primary-main')).toBe('#FF0000')
  })

  it('loadAccent restores stored accent', () => {
    localStorage.setItem(ACCENT_KEY, '#00FF00')
    loadAccent()
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#00FF00')
  })

  it('loadAccent is a no-op when nothing stored', () => {
    loadAccent()
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/theme.test.ts`
Expected: FAIL — `Cannot find module './theme'`

- [ ] **Step 4: Create theme module**

Create `frontend/src/theme.ts` (hex values copied from `src/index.css` — they must stay in sync):

```ts
import { createTheme } from '@mui/material/styles'

export const ACCENT_KEY = 'ea-accent'

const display = '"Space Grotesk", sans-serif'

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    dark: {
      palette: {
        primary: { main: '#F2A65A' },
        secondary: { main: '#6C8FE5' },
        error: { main: '#E5484D' },
        warning: { main: '#F2A65A' },
        info: { main: '#6C8FE5' },
        success: { main: '#3DD68C' },
        background: { default: '#0B1220', paper: '#131C2B' },
        text: { primary: '#E6EDF7', secondary: '#8A9AB5' },
        divider: '#243149',
      },
    },
    light: {
      palette: {
        primary: { main: '#E67E22' },
        secondary: { main: '#3498DB' },
        error: { main: '#C0392B' },
        warning: { main: '#E67E22' },
        info: { main: '#3498DB' },
        success: { main: '#27AE60' },
        background: { default: '#EEF2F9', paper: '#FFFFFF' },
        text: { primary: '#0B1220', secondary: '#475569' },
        divider: '#CBD5E6',
      },
    },
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    fontSize: 13,
    h1: { fontFamily: display },
    h2: { fontFamily: display },
    h3: { fontFamily: display },
    h4: { fontFamily: display },
    h5: { fontFamily: display },
    h6: { fontFamily: display },
  },
  shape: { borderRadius: 8 },
})

// Accent personalization: one call updates Tailwind var + MUI var.
export function applyAccent(color: string) {
  localStorage.setItem(ACCENT_KEY, color)
  setAccentVars(color)
}

export function loadAccent() {
  const stored = localStorage.getItem(ACCENT_KEY)
  if (stored) setAccentVars(stored)
}

function setAccentVars(color: string) {
  document.documentElement.style.setProperty('--color-accent', color)
  document.documentElement.style.setProperty('--mui-palette-primary-main', color)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/theme.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Mount ThemeProvider in main.tsx**

Modify `frontend/src/main.tsx` — wrap the existing tree. Current file wraps `<App />` in `QueryClientProvider` (read it first; keep everything else). Result shape:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme} defaultMode="system" modeStorageKey="ea-theme">
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

Keep any existing imports/providers not shown here (e.g. Toaster) — only add ThemeProvider + CssBaseline around `<App />`.

- [ ] **Step 7: Full test suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all tests PASS (26 existing + 5 new), build succeeds. If SignatureBar's MutationObserver test breaks because MUI now also sets a `dark` class: MUI adds class `dark` in dark mode; existing CSS treats no-`light`-class as dark, so visual behavior is unchanged — fix any test asserting exact classList to assert `.contains('light')` only.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/theme.ts frontend/src/theme.test.ts frontend/src/main.tsx
git commit -m "feat(frontend): MUI v7 theme bridge — cssVariables, colorSchemes, accent sync"
```

---

### Task 2: react-router + backend SPA fallback

**Files:**
- Modify: `frontend/src/main.tsx` (add BrowserRouter)
- Modify: `frontend/src/App.tsx` (Routes instead of switch)
- Modify: `frontend/src/components/Sidebar.tsx` (navigate via router)
- Create: `frontend/src/App.routes.test.tsx`
- Modify: `backend/web/app.py:302-303` (SPA fallback)
- Create/Modify: backend test `backend/tests/test_spa_fallback.py`

**Interfaces:**
- Consumes: ThemeProvider setup from Task 1.
- Produces: Route table `/`, `/inbox`, `/tasks`, `/calendar`, `/trending`, `/deadlines`, `/people`, `/topics`, `/docs`, `/settings`; unknown → redirect `/`. Sidebar owns its navigation (props reduced to `collapsed`, `onToggle`). `App` passes `onViewChange={(id) => navigate(id === 'dashboard' ? '/' : '/' + id)}` to CommandPalette (CommandPalette itself unchanged).

- [ ] **Step 1: Write the failing route test**

Create `frontend/src/App.routes.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from './theme'
import { App } from './App'

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('routing', () => {
  it('renders sidebar nav links as router links', async () => {
    renderAt('/')
    const link = await screen.findByRole('link', { name: /inbox/i })
    expect(link).toHaveAttribute('href', '/inbox')
  })

  it('marks the active route with aria-current', async () => {
    renderAt('/settings')
    const link = await screen.findByRole('link', { name: /settings/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.routes.test.tsx`
Expected: FAIL — no links rendered (Sidebar uses buttons) / MemoryRouter has no effect.

- [ ] **Step 3: Convert App.tsx to Routes**

Modify `frontend/src/App.tsx`:
- Delete `activeView` state, `renderView()`, and the `applyTheme`/`getStoredMode` import + the theme `useEffect` lines (MUI owns mode now; keep the briefing auto-open logic). Replace accent-restore lines with `loadAccent()` from `@/theme`.
- Add imports: `import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'` and `import { loadAccent } from '@/theme'`.
- In the component: `const navigate = useNavigate()`.
- Replace `{renderView()}` inside `<Suspense>` with:

```tsx
<Routes>
  <Route path="/" element={<DashboardView />} />
  <Route path="/inbox" element={<InboxView />} />
  <Route path="/tasks" element={<TasksView />} />
  <Route path="/calendar" element={<CalendarView />} />
  <Route path="/trending" element={<TrendingView />} />
  <Route path="/deadlines" element={<DeadlinesView />} />
  <Route path="/people" element={<PeopleView />} />
  <Route path="/topics" element={<TopicsView />} />
  <Route path="/docs" element={<DocsView />} />
  <Route path="/settings" element={<SettingsView />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

- CommandPalette prop: `onViewChange={(id) => navigate(id === 'dashboard' ? '/' : '/' + id)}`.
- Sidebar props: `<Sidebar collapsed={collapsedSidebar} onToggle={setCollapsedSidebar} />`.
- First `useEffect` becomes:

```tsx
useEffect(() => {
  loadAccent()
  const today = new Date().toISOString().split('T')[0]
  if (localStorage.getItem('ea-briefing-shown') !== today) {
    setBriefingOpen(true)
    localStorage.setItem('ea-briefing-shown', today)
  }
}, [])
```

- [ ] **Step 4: Convert Sidebar to NavLink**

Modify `frontend/src/components/Sidebar.tsx`: add `route` to items, replace `<button>` nav items with `<NavLink>`. Props become `{ collapsed: boolean; onToggle: (c: boolean) => void }`. Keep all Tailwind classes (MUI rebuild is Task 3):

```tsx
import { NavLink } from 'react-router-dom'
// SIDEBAR_ITEMS: add route field, drop `active`
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
```

Nav item render (NavLink sets `aria-current="page"` automatically when active):

```tsx
{SIDEBAR_ITEMS.map((item) => (
  <NavLink
    key={item.id}
    to={item.route}
    end={item.route === '/'}
    title={item.label}
    aria-label={item.label}
    className={({ isActive }) =>
      `h-11 w-11 flex items-center justify-center rounded-md transition-all relative ${
        isActive ? 'text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <item.icon size={20} />
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent rounded-r" />
        )}
      </>
    )}
  </NavLink>
))}
```

- [ ] **Step 5: Wrap App in BrowserRouter (main.tsx)**

In `frontend/src/main.tsx`, add `import { BrowserRouter } from 'react-router-dom'` and wrap: `<BrowserRouter><App /></BrowserRouter>` (inside ThemeProvider).

- [ ] **Step 6: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: `App.routes.test.tsx` PASSES. Any pre-existing test that renders `<App/>` or `<Sidebar/>` without a router will fail with "useNavigate/NavLink outside Router" — wrap those renders in `<MemoryRouter>` and update Sidebar test props (remove `activeView`/`onViewChange`).

- [ ] **Step 7: Write failing backend SPA-fallback test**

Create `backend/tests/test_spa_fallback.py` (mirror setup style of existing tests in `backend/tests/` — check how they build the app with `create_app`):

```python
"""Deep links like /inbox must serve index.html (SPA fallback)."""
from pathlib import Path

from fastapi.testclient import TestClient

from web.app import create_app


def _mk_static(tmp_path: Path) -> Path:
    static = tmp_path / "dist"
    static.mkdir()
    (static / "index.html").write_text("<html><body>scout</body></html>")
    return static


def test_deep_link_serves_index(tmp_path):
    app = create_app(tmp_path / "t.sqlite", static_dir=_mk_static(tmp_path))
    client = TestClient(app)
    r = client.get("/inbox")
    assert r.status_code == 200
    assert "scout" in r.text


def test_api_404_still_404(tmp_path):
    app = create_app(tmp_path / "t.sqlite", static_dir=_mk_static(tmp_path))
    client = TestClient(app)
    assert client.get("/api/nope").status_code == 404
```

Run: `cd backend && python -m pytest tests/test_spa_fallback.py -q`
Expected: FAIL — `/inbox` returns 404.

- [ ] **Step 8: Add SPA fallback in web/app.py**

Modify `backend/web/app.py`. Add near the imports:

```python
class SPAStaticFiles(StaticFiles):
    """Serve index.html for unknown non-API paths (client-side routing)."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        return response
```

Change line ~303 mount to use it:

```python
app.mount("/", SPAStaticFiles(directory=str(static_dir), html=True), name="static")
```

`/api/*` routes are registered on the app before the mount, so they never reach the static handler — API 404s stay 404.

- [ ] **Step 9: Run backend tests**

Run: `cd backend && python -m pytest -q`
Expected: all PASS (136 existing + 2 new).

- [ ] **Step 10: Commit**

```bash
git add frontend/src backend/web/app.py backend/tests/test_spa_fallback.py
git commit -m "feat: react-router navigation + SPA fallback for deep links"
```

---

### Task 3: Sidebar → MUI

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx` (full rewrite)
- Test: existing Sidebar assertions live in view/App tests; routing test from Task 2 must stay green.

**Interfaces:**
- Consumes: NavLink routing from Task 2, MUI theme from Task 1.
- Produces: same props `{ collapsed: boolean; onToggle: (c: boolean) => void }`; nav links keep `aria-label` + `aria-current` semantics (Task 2 test depends on them).

- [ ] **Step 1: Rewrite Sidebar with MUI**

Replace `frontend/src/components/Sidebar.tsx` content with:

```tsx
import { NavLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import {
  Calendar, CheckSquare, Cog, Inbox, Menu, TrendingUp,
  AlertCircle, FileText, Grid3x3, Users, Hash,
} from 'lucide-react'

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
  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: 56,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconButton onClick={() => onToggle(!collapsed)} aria-label="Toggle sidebar" color="primary">
          <Menu size={20} />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 1.5 }}>
        {SIDEBAR_ITEMS.map((item) => (
          <Tooltip key={item.id} title={item.label} placement="right">
            <NavLink to={item.route} end={item.route === '/'} aria-label={item.label} style={{ position: 'relative' }}>
              {({ isActive }) => (
                <>
                  <IconButton component="span" color={isActive ? 'primary' : 'default'} aria-hidden>
                    <item.icon size={20} />
                  </IconButton>
                  {isActive && (
                    <Box
                      sx={{
                        position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
                        width: 3, height: 24, bgcolor: 'primary.main', borderRadius: '0 3px 3px 0',
                      }}
                    />
                  )}
                </>
              )}
            </NavLink>
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: 1, borderColor: 'divider' }}>
        <Tooltip title="Help" placement="right">
          <IconButton aria-label="Help" size="small">?</IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS — Task 2's routing test still finds links by `aria-label` with correct `href` + `aria-current`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "refactor(frontend): Sidebar in MUI (IconButton/Tooltip + NavLink)"
```

---

### Task 4: SignatureBar → MUI + useColorScheme

**Files:**
- Modify: `frontend/src/components/SignatureBar.tsx` (full rewrite)
- Create: `frontend/src/components/SignatureBar.test.tsx`

**Interfaces:**
- Consumes: MUI theme (Task 1).
- Produces: same props `{ onCommandOpen?, onOpenBriefing? }`. Theme toggling now via MUI `useColorScheme` — no `lib/theme` import (Task 6 deletes that file).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/SignatureBar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { SignatureBar } from './SignatureBar'

function renderBar() {
  return render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <SignatureBar />
    </ThemeProvider>,
  )
}

describe('SignatureBar', () => {
  it('toggles color mode via useColorScheme', () => {
    localStorage.setItem('ea-theme', 'dark')
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: /switch to light mode/i }))
    expect(localStorage.getItem('ea-theme')).toBe('light')
  })

  it('shows brand and command palette trigger', () => {
    renderBar()
    expect(screen.getByText('SCOUT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open command palette/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/SignatureBar.test.tsx`
Expected: FAIL — current implementation writes via `setStoredMode` but is not inside ThemeProvider contract; the toggle-name assertion may pass, the localStorage assertion fails because current code resolves from MutationObserver default 'dark' — treat any failure as the red step.

- [ ] **Step 3: Rewrite SignatureBar with MUI**

Replace `frontend/src/components/SignatureBar.tsx` content with (horizon clock kept, framer-motion dropped for CSS):

```tsx
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'
import { Sun, Moon, Sparkles } from 'lucide-react'

interface SignatureBarProps {
  onCommandOpen?: () => void
  onOpenBriefing?: () => void
}

const HOURS = [7, 9, 11, 13, 15, 17]

export function SignatureBar({ onCommandOpen, onOpenBriefing }: SignatureBarProps) {
  const [time, setTime] = useState(new Date())
  const { mode, systemMode, setMode } = useColorScheme()
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'dark'

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const totalMinutes = time.getHours() * 60 + time.getMinutes()
  const positionPercent = Math.max(0, Math.min(100, ((totalMinutes - 7 * 60) / (11 * 60)) * 100))

  return (
    <Box
      sx={{
        height: 48, display: 'flex', alignItems: 'center', px: 2, gap: 1.5,
        bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
      }}
    >
      <Typography variant="h6" sx={{ fontSize: 18, mr: 1 }}>SCOUT</Typography>
      <Box sx={{ position: 'relative', flex: 1, height: 32 }}>
        <Box
          data-horizon
          sx={{
            position: 'absolute', left: 0, right: 0, top: '50%', height: 3, borderRadius: 1,
            background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-2))',
          }}
        />
        <Box sx={{ position: 'absolute', transform: 'translateX(-50%)', left: `${positionPercent}%`, top: 'calc(50% - 9px)' }}>
          <Box
            sx={{
              width: 0, height: 0,
              borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
              borderBottom: '10px solid var(--color-accent)',
              filter: 'drop-shadow(0 0 4px var(--color-accent))',
              '@media (prefers-reduced-motion: no-preference)': { animation: 'pulse 2s infinite' },
              '@keyframes pulse': { '0%, 100%': { opacity: 0.8 }, '50%': { opacity: 1 } },
            }}
          />
        </Box>
        {HOURS.map((h) => (
          <Typography
            key={h}
            sx={{ position: 'absolute', left: `${((h - 7) / 11) * 100}%`, top: '100%', fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: 'text.secondary' }}
          >
            {h > 12 ? `${h - 12}p` : `${h}a`}
          </Typography>
        ))}
      </Box>
      <IconButton size="small" onClick={onOpenBriefing} aria-label="Open today briefing">
        <Sparkles size={16} />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}
        aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </IconButton>
      <Button size="small" variant="outlined" onClick={onCommandOpen} aria-label="Open command palette" sx={{ minWidth: 0, px: 1, fontSize: 11 }}>
        ⌘K
      </Button>
    </Box>
  )
}
```

Note: "last ran 14:32" hardcoded string dropped (fake data). Briefing button added — SignatureBar previously ignored `onOpenBriefing`; wire it.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS. If MUI stores mode under a different structure, assert via `screen.getByRole('button', { name: /switch to dark mode/i })` appearing after click instead of raw localStorage.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SignatureBar.tsx frontend/src/components/SignatureBar.test.tsx
git commit -m "refactor(frontend): SignatureBar in MUI, mode toggle via useColorScheme"
```

---

### Task 5: RightDrawer + TodayBriefing shell → MUI

**Files:**
- Modify: `frontend/src/components/RightDrawer.tsx` (rewrite markup, keep queries)
- Modify: `frontend/src/components/RightDrawer.test.tsx` (only if selectors break)
- Modify: `frontend/src/components/TodayBriefing.tsx` (container → MUI Dialog; inner content untouched)

**Interfaces:**
- Consumes: MUI theme (Task 1).
- Produces: RightDrawer props unchanged (none). TodayBriefing props unchanged `{ open: boolean; onClose: () => void }`.

- [ ] **Step 1: Rewrite RightDrawer markup with MUI**

Keep both `useQuery` calls, `formatCountdown`, sorting, and `isUrgent` exactly as-is. Replace the returned JSX with MUI equivalents:

```tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import { TrendingUp, TrendingDown, Clock } from 'lucide-react'
```

Return shape (data logic above unchanged):

```tsx
return (
  <Box sx={{ width: 300, borderLeft: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
    {deadlinesError_ && <Alert severity="error" sx={{ m: 2 }}>Error loading drawer</Alert>}
    <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Deadlines</Typography>
        {deadlinesLoading ? (
          <Typography variant="caption" color="text.secondary">Loading…</Typography>
        ) : sortedDeadlines.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No deadlines tracked.</Typography>
        ) : (
          <Stack spacing={1} sx={{ mt: 1 }}>
            {sortedDeadlines.map((item) => (
              <Paper
                key={item.id}
                variant="outlined"
                sx={{
                  px: 1.5, py: 1,
                  ...(isUrgent(item.countdown_seconds) && { borderColor: 'error.main', bgcolor: 'rgba(229, 72, 77, 0.1)' }),
                }}
              >
                <Typography variant="body2" fontWeight={500}>{item.title}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                  <Clock size={12} />
                  <Typography variant="caption" fontFamily='"JetBrains Mono", monospace'>
                    {formatCountdown(item.countdown_seconds)}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Trending</Typography>
        {trendsLoading ? (
          <Typography variant="caption" color="text.secondary">Loading…</Typography>
        ) : trends.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No trends data.</Typography>
        ) : (
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            {trends.map((item) => (
              <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>{item.term}</Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  icon={item.delta && item.delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  label={item.delta ? (item.delta > 0 ? '+' : '') + item.delta + '%' : '—'}
                  color={item.delta && item.delta > 0 ? 'success' : 'default'}
                />
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  </Box>
)
```

- [ ] **Step 2: Run RightDrawer tests, fix selectors only**

Run: `cd frontend && npx vitest run src/components/RightDrawer.test.tsx`
Expected: PASS if the test queries by text; if it queries Tailwind classes, update those assertions to text/role queries.

- [ ] **Step 3: TodayBriefing container → MUI Dialog**

In `frontend/src/components/TodayBriefing.tsx`: replace the outer overlay/backdrop wrapper (fixed-position div or Radix Dialog) with:

```tsx
import Dialog from '@mui/material/Dialog'
// render:
<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
  {/* existing inner content unchanged */}
</Dialog>
```

Read the file first; only the outermost open/close container changes — inner Tailwind content stays.

- [ ] **Step 4: Full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all PASS, build green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RightDrawer.tsx frontend/src/components/RightDrawer.test.tsx frontend/src/components/TodayBriefing.tsx
git commit -m "refactor(frontend): RightDrawer + TodayBriefing shell in MUI"
```

---

### Task 6: Settings theme controls + delete lib/theme.ts

**Files:**
- Modify: `frontend/src/views/Settings.tsx:4,24-34,147` (mode + accent handlers only)
- Delete: `frontend/src/lib/theme.ts`, `frontend/src/lib/theme.test.ts`
- Modify: `frontend/src/App.tsx` (verify no lib/theme import remains — done in Task 2)

**Interfaces:**
- Consumes: `useColorScheme` (MUI), `applyAccent` from `@/theme` (Task 1).
- Produces: no module exports change; `@/lib/theme` no longer exists — nothing may import it.

- [ ] **Step 1: Swap Settings theme mode control to useColorScheme**

In `frontend/src/views/Settings.tsx`:
- Replace `import { getStoredMode, setStoredMode, type ThemeMode } from '@/lib/theme'` with `import { useColorScheme } from '@mui/material/styles'` and `import { applyAccent } from '@/theme'`.
- Replace `const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getStoredMode())` with `const { mode, setMode } = useColorScheme()` and use `mode ?? 'system'` where `currentTheme` was read.
- At the mode-select handler (line ~147): replace `setStoredMode(mode)` + `setCurrentTheme(mode)` with `setMode(mode)`.
- Replace the accent effect (lines ~24-34) `localStorage.setItem('ea-accent', currentAccent)` + manual style set with `applyAccent(currentAccent)`.
- Type for mode options: `'dark' | 'light' | 'system'` inline (ThemeMode type is gone).

- [ ] **Step 2: Delete lib/theme**

```bash
cd frontend && rm src/lib/theme.ts src/lib/theme.test.ts && grep -rn "lib/theme" src && echo "STILL REFERENCED" || echo "clean"
```

Expected: `clean` (grep finds nothing).

- [ ] **Step 3: Full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS. Settings tests asserting old behavior: update to assert `setMode` effect (mode select changes localStorage `ea-theme`) and accent via `applyAccent` (localStorage `ea-accent`).

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(frontend): Settings theme controls on useColorScheme; drop lib/theme"
```

---

### Task 7: Verification — visual + full suites

**Files:** none (verification only)

- [ ] **Step 1: Full test suites**

```bash
cd frontend && npx vitest run && npm run build
cd ../backend && python -m pytest -q
```

Expected: all green.

- [ ] **Step 2: Visual verification (established screenshot flow)**

```bash
cd /home/user/code/Scout_EA && source .venv/bin/activate
python -c "import sys; sys.path.insert(0, 'backend'); import seed_demo; seed_demo.seed('ea.sqlite')"
# build fresh frontend into the dir run_web serves, then run backend on canonical port
cd frontend && npm run build && cd ..
python backend/run_web.py &  # serves :8765
```

Playwright-screenshot (per `frontend/screenshots/` established flow): dashboard `/`, `/inbox` (deep link — must NOT 404), `/settings` in dark + light. Verify: sidebar navigation works by URL, theme toggle persists across reload, accent color applies to MUI buttons.

Kill server after.

- [ ] **Step 3: Check bundle size**

Run: `ls -la frontend/dist/assets/*.js | sort -k5 -n | tail -3`
Expected: main chunk in same ballpark as before (~409KB) + MUI chunk; note numbers for Phase 3 comparison.

- [ ] **Step 4: Merge**

```bash
git checkout master  # already on master per repo convention of no-ff merges from feature branches
# if work was done on a feature branch: git merge --no-ff phase1-mui-foundation
```

Follow repo convention (no-ff merges to master). CI must be green.

---

## Self-Review Notes

- Spec coverage: theme bridge (Task 1), router + query-param-capable routes + SPA fallback (Task 2), shell in MUI — Sidebar (3), SignatureBar (4), RightDrawer + TodayBriefing Dialog (5), theme-system consolidation (6), verification (7). cmdk palette intentionally untouched (spec: stays).
- Spec amendment: backend SPA fallback (`SPAStaticFiles`) added — required for deep links; spec's "no backend changes" scoped to API/data, this is static serving only.
- Query-param filters on views: contract established by routes now; actual filter parsing lands in Phase 2/3 when widgets link in.
- `--color-*` vars stay in index.css: Tailwind views + horizon gradient still consume them; theme.ts duplicates hexes (sync noted in comment).
