# Sub-Project B — Multi-Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Scout EA's single palette + accent-swatch picker with 5 curated, user-selectable themes (each dark + light, each a signature texture), chosen from a Settings theme picker, defaulting to VSCode/Win11 Fluent.

**Architecture:** A `themes/` registry — one `ThemeDef` per palette (tokens for both modes + categorical chart hues + a texture id), a factory turning a `ThemeDef` into a MUI `createTheme` with both color schemes, and a `ThemeSelectionProvider` that owns the selected key, renders the MUI ThemeProvider for it, and pushes per-theme CSS variables + a texture attribute onto `<html>`. Settings gets a theme-card picker; the old `theme.ts` shrinks to a compatibility shim re-exporting the default theme.

**Tech Stack:** React 19, TypeScript, MUI v7 (`createTheme`/`useColorScheme`/`cssVariables`), react-router, vitest.

## Global Constraints

- MUI v7: no Typography/Box system props — `sx` only. MUI X Community only. No new dependencies.
- Preserve behavior: routes, drill-down params, mode toggle (dark/light/system) via MUI `useColorScheme` + existing `ea-theme` key, all existing tests.
- Before EVERY commit, all three green from `frontend/`: `npx vitest run`, `npx tsc -b`, `npm run build`. tsc is mandatory (vitest does not typecheck).
- Files under 500 lines. Semantic commits. Branch: `subproject-b-theme-system` from master.
- localStorage contracts: `ea-theme` (mode — unchanged); **new** `ea-theme-name` (selected theme key, default `vscode`). `ea-accent` is retired.
- All 5 categorical sets are validator-locked (CVD + contrast pass both modes). Charts always direct-label. Two light-mode hues (Forest/VSCode teal ~0.09 chroma) are an accepted, documented tradeoff.
- The 5 theme keys are exactly: `vscode`, `cyberpunk`, `monokai`, `forest`, `vibrant`. Default = `vscode`. Picker order = registry order (vscode first).
- Spec (authoritative hex source): `docs/superpowers/specs/2026-07-11-subproject-b-theme-system-design.md`.
- **Migration deviation from spec:** spec said "delete theme.ts". Because 11 test files import `theme` from `@/theme`, `theme.ts` is instead shrunk to a shim re-exporting the default theme from the registry (Task 5). Only the accent functions are deleted.

---

### Task 1: Theme foundation — types, factory, registry, 5 themes

**Files:**
- Create: `frontend/src/themes/types.ts`
- Create: `frontend/src/themes/factory.ts`
- Create: `frontend/src/themes/vscode.ts`, `cyberpunk.ts`, `monokai.ts`, `forest.ts`, `vibrant.ts`
- Create: `frontend/src/themes/registry.ts`
- Test: `frontend/src/themes/registry.test.ts`, `frontend/src/themes/factory.test.ts`

**Interfaces:**
- Produces: `ThemeTokens`, `ThemeDef`, `TextureId` (types); `buildMuiTheme(def: ThemeDef): Theme`; `THEMES: ThemeDef[]`, `DEFAULT_THEME_KEY = 'vscode'`, `getTheme(key: string): ThemeDef` (fallback to default).

- [ ] **Step 1: Create types.ts**

```ts
export type TextureId = 'mica' | 'scanlines' | 'vignette' | 'grain' | 'dots'

export interface ThemeTokens {
  bg: string
  paper: string
  divider: string
  textPrimary: string
  textSecondary: string
  primary: string
  onPrimary: string
  secondary: string
  error: string
  warning: string
  success: string
  info: string
  cat: [string, string, string, string, string]
}

export interface ThemeDef {
  key: string
  label: string
  mood: string
  texture: TextureId
  dark: ThemeTokens
  light: ThemeTokens
}
```

- [ ] **Step 2: Create the 5 theme files**

Each file exports one `ThemeDef` with the spec's locked hexes. Create `frontend/src/themes/vscode.ts`:

```ts
import type { ThemeDef } from './types'

export const vscode: ThemeDef = {
  key: 'vscode',
  label: 'VSCode / Win11 Fluent',
  mood: 'familiar tooling — quiet, professional',
  texture: 'mica',
  dark: {
    bg: '#1e1e1e', paper: '#252526', divider: '#333333',
    textPrimary: '#d4d4d4', textSecondary: '#858585',
    primary: '#3794ff', onPrimary: '#04121f', secondary: '#4ec9b0',
    error: '#f14c4c', warning: '#cca700', success: '#89d185', info: '#3794ff',
    cat: ['#3794ff', '#4ec9b0', '#dd9a5f', '#d4c96a', '#c586c0'],
  },
  light: {
    bg: '#f3f3f3', paper: '#ffffff', divider: '#e5e5e5',
    textPrimary: '#1f1f1f', textSecondary: '#616161',
    primary: '#005fb8', onPrimary: '#ffffff', secondary: '#007a6e',
    error: '#d13438', warning: '#9d5d00', success: '#107c10', info: '#005fb8',
    cat: ['#005fb8', '#c0491a', '#0e7a6b', '#8764b8', '#107c10'],
  },
}
```

`frontend/src/themes/cyberpunk.ts`:

```ts
import type { ThemeDef } from './types'

export const cyberpunk: ThemeDef = {
  key: 'cyberpunk',
  label: 'Cyberpunk',
  mood: 'neon night city — magenta + cyan, max contrast',
  texture: 'scanlines',
  dark: {
    bg: '#0a0612', paper: '#140a1f', divider: '#2a1740',
    textPrimary: '#f0e6ff', textSecondary: '#9a7fb8',
    primary: '#ff2e88', onPrimary: '#12000a', secondary: '#00e5ff',
    error: '#ff3860', warning: '#ffb000', success: '#39ff9e', info: '#00e5ff',
    cat: ['#ff2e88', '#00e5ff', '#b14aff', '#ffdd00', '#39ff9e'],
  },
  light: {
    bg: '#f6f0fb', paper: '#ffffff', divider: '#ece0f5',
    textPrimary: '#1a0b26', textSecondary: '#6e5a80',
    primary: '#d6006e', onPrimary: '#ffffff', secondary: '#0088a8',
    error: '#e0114f', warning: '#c77b00', success: '#0a9d5a', info: '#0088a8',
    cat: ['#d6006e', '#0088a8', '#8b2fd6', '#b58900', '#0a9d5a'],
  },
}
```

`frontend/src/themes/monokai.ts`:

```ts
import type { ThemeDef } from './types'

export const monokai: ThemeDef = {
  key: 'monokai',
  label: 'Dark Monokai',
  mood: 'the editor classic — pink/green/cyan on warm charcoal',
  texture: 'vignette',
  dark: {
    bg: '#22231e', paper: '#2c2d26', divider: '#3a3b32',
    textPrimary: '#f8f8f2', textSecondary: '#a59f8a',
    primary: '#f92672', onPrimary: '#1a0410', secondary: '#66d9ef',
    error: '#f92672', warning: '#fd971f', success: '#a6e22e', info: '#66d9ef',
    cat: ['#f92672', '#a6e22e', '#66d9ef', '#ae81ff', '#fd971f'],
  },
  light: {
    bg: '#fafaf5', paper: '#ffffff', divider: '#e8e6d8',
    textPrimary: '#272822', textSecondary: '#6a6550',
    primary: '#d81b60', onPrimary: '#ffffff', secondary: '#0089a6',
    error: '#d81b60', warning: '#c46a10', success: '#6a9c11', info: '#0089a6',
    cat: ['#d81b60', '#6a9c11', '#0089a6', '#8b52d6', '#c46a10'],
  },
}
```

`frontend/src/themes/forest.ts`:

```ts
import type { ThemeDef } from './types'

export const forest: ThemeDef = {
  key: 'forest',
  label: 'Forest Earthy',
  mood: 'calm & organic — sage + terracotta, grounded',
  texture: 'grain',
  dark: {
    bg: '#10150f', paper: '#191f16', divider: '#262e20',
    textPrimary: '#e9ede3', textSecondary: '#9aa890',
    primary: '#86bf6b', onPrimary: '#0e1a0a', secondary: '#e0925b',
    error: '#d9705e', warning: '#e0b24a', success: '#86bf6b', info: '#6fb0a0',
    cat: ['#7dbf5f', '#31b39a', '#e0b23a', '#e07a45', '#b579b0'],
  },
  light: {
    bg: '#f5f7ef', paper: '#ffffff', divider: '#e1e6d5',
    textPrimary: '#1b2415', textSecondary: '#5c6650',
    primary: '#47762c', onPrimary: '#ffffff', secondary: '#b5652a',
    error: '#b8402e', warning: '#9a7318', success: '#47762c', info: '#2f7d70',
    cat: ['#3f7a2c', '#b8461c', '#0e7a6b', '#7d4a7a', '#8a6a10'],
  },
}
```

`frontend/src/themes/vibrant.ts`:

```ts
import type { ThemeDef } from './types'

export const vibrant: ThemeDef = {
  key: 'vibrant',
  label: 'Vibrant Playful',
  mood: 'fun & whimsical — coral + violet, higher energy',
  texture: 'dots',
  dark: {
    bg: '#17121e', paper: '#221a2c', divider: '#322842',
    textPrimary: '#f4effa', textSecondary: '#b3a6c6',
    primary: '#ff6b6b', onPrimary: '#2a0f0f', secondary: '#c084fc',
    error: '#ff6b6b', warning: '#fbbf24', success: '#34d399', info: '#60a5fa',
    cat: ['#ff6b6b', '#c084fc', '#2dd4bf', '#fbbf24', '#60a5fa'],
  },
  light: {
    bg: '#fdf5fa', paper: '#ffffff', divider: '#f0deec',
    textPrimary: '#2a1936', textSecondary: '#6e5a7e',
    primary: '#e0286e', onPrimary: '#ffffff', secondary: '#8b3fd6',
    error: '#d61f5c', warning: '#d97706', success: '#0e9f6e', info: '#2f6fd6',
    cat: ['#e0286e', '#8b3fd6', '#0d9488', '#d97706', '#2f6fd6'],
  },
}
```

- [ ] **Step 3: Create factory.ts**

```ts
import { createTheme, type Theme } from '@mui/material/styles'
import type { ThemeDef, ThemeTokens } from './types'

const display = '"Space Grotesk", sans-serif'

function palette(t: ThemeTokens) {
  return {
    primary: { main: t.primary, contrastText: t.onPrimary },
    secondary: { main: t.secondary },
    error: { main: t.error },
    warning: { main: t.warning },
    info: { main: t.info },
    success: { main: t.success },
    background: { default: t.bg, paper: t.paper },
    text: { primary: t.textPrimary, secondary: t.textSecondary },
    divider: t.divider,
  }
}

export function buildMuiTheme(def: ThemeDef): Theme {
  return createTheme({
    cssVariables: { colorSchemeSelector: 'class' },
    colorSchemes: {
      dark: { palette: palette(def.dark) },
      light: { palette: palette(def.light) },
    },
    typography: {
      fontFamily: '"Inter", sans-serif',
      fontSize: 13,
      h1: { fontFamily: display }, h2: { fontFamily: display },
      h3: { fontFamily: display }, h4: { fontFamily: display },
      h5: { fontFamily: display }, h6: { fontFamily: display },
    },
    shape: { borderRadius: 8 },
  })
}
```

- [ ] **Step 4: Create registry.ts**

```ts
import type { ThemeDef } from './types'
import { vscode } from './vscode'
import { cyberpunk } from './cyberpunk'
import { monokai } from './monokai'
import { forest } from './forest'
import { vibrant } from './vibrant'

// Registry order = picker order. Adding a theme = one file + one entry here.
export const THEMES: ThemeDef[] = [vscode, cyberpunk, monokai, forest, vibrant]

export const DEFAULT_THEME_KEY = 'vscode'

export function getTheme(key: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.key === key) ?? THEMES[0]
}
```

- [ ] **Step 5: Write the failing tests**

Create `frontend/src/themes/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { THEMES, DEFAULT_THEME_KEY, getTheme } from './registry'

const HEX = /^#[0-9a-f]{6}$/i

describe('theme registry', () => {
  it('has 5 themes with unique keys, vscode first (default)', () => {
    expect(THEMES).toHaveLength(5)
    const keys = THEMES.map((t) => t.key)
    expect(new Set(keys).size).toBe(5)
    expect(THEMES[0].key).toBe(DEFAULT_THEME_KEY)
    expect(DEFAULT_THEME_KEY).toBe('vscode')
  })

  it('every theme is fully populated in both modes', () => {
    const TEX = ['mica', 'scanlines', 'vignette', 'grain', 'dots']
    for (const t of THEMES) {
      expect(t.label).toBeTruthy()
      expect(t.mood).toBeTruthy()
      expect(TEX).toContain(t.texture)
      for (const mode of [t.dark, t.light]) {
        expect(mode.cat).toHaveLength(5)
        for (const c of [mode.bg, mode.paper, mode.primary, mode.secondary, ...mode.cat]) {
          expect(c).toMatch(HEX)
        }
      }
    }
  })

  it('getTheme falls back to default for unknown/empty keys', () => {
    expect(getTheme('nope').key).toBe('vscode')
    expect(getTheme(null).key).toBe('vscode')
    expect(getTheme('cyberpunk').key).toBe('cyberpunk')
  })
})
```

Create `frontend/src/themes/factory.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildMuiTheme } from './factory'
import { getTheme } from './registry'

describe('buildMuiTheme', () => {
  it('maps a ThemeDef to both MUI color schemes', () => {
    const theme = buildMuiTheme(getTheme('cyberpunk'))
    expect(theme.colorSchemes.dark?.palette.primary.main).toBe('#ff2e88')
    expect(theme.colorSchemes.light?.palette.primary.main).toBe('#d6006e')
    expect(theme.colorSchemes.dark?.palette.background.default).toBe('#0a0612')
  })

  it('enables class-based css variables', () => {
    const theme = buildMuiTheme(getTheme('vscode'))
    expect(theme.colorSchemeSelector).toBe('class')
  })
})
```

- [ ] **Step 6: Run tests (red → green) + all three**

Run: `cd frontend && npx vitest run src/themes && npx tsc -b && npm run build`
Expected: registry + factory tests PASS; tsc + build green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/themes
git commit -m "feat(frontend): theme registry, factory, and 5 validator-locked themes"
```

---

### Task 2: ThemeSelectionProvider — swap MUI provider, push CSS vars + texture attr

**Files:**
- Create: `frontend/src/themes/ThemeSelectionProvider.tsx`
- Create: `frontend/src/themes/applyThemeVars.ts`
- Create: `frontend/src/themes/ThemeSelectionProvider.test.tsx`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: `THEMES`, `getTheme`, `DEFAULT_THEME_KEY` (Task 1), `buildMuiTheme` (Task 1), MUI `useColorScheme`.
- Produces:
  - `applyThemeVars(def: ThemeDef, resolvedMode: 'dark' | 'light'): void` — sets on `document.documentElement.style`: `--color-accent` = tokens.primary, `--color-accent-2` = tokens.secondary, `--chart-1..--chart-5` = tokens.cat; sets `document.documentElement.dataset.themeTexture = def.texture`.
  - `ThemeSelectionProvider` (default export, wraps children); `useThemeSelection(): { selectedKey: string; setThemeKey: (key: string) => void }`.

- [ ] **Step 1: Write applyThemeVars + its test**

Create `frontend/src/themes/applyThemeVars.ts`:

```ts
import type { ThemeDef } from './types'

export function applyThemeVars(def: ThemeDef, resolvedMode: 'dark' | 'light'): void {
  const t = resolvedMode === 'light' ? def.light : def.dark
  const root = document.documentElement
  root.style.setProperty('--color-accent', t.primary)
  root.style.setProperty('--color-accent-2', t.secondary)
  t.cat.forEach((c, i) => root.style.setProperty(`--chart-${i + 1}`, c))
  root.dataset.themeTexture = def.texture
}
```

Create `frontend/src/themes/ThemeSelectionProvider.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { applyThemeVars } from './applyThemeVars'
import { getTheme } from './registry'
import ThemeSelectionProvider, { useThemeSelection } from './ThemeSelectionProvider'

function Probe() {
  const { selectedKey, setThemeKey } = useThemeSelection()
  return (
    <div>
      <span data-testid="key">{selectedKey}</span>
      <button onClick={() => setThemeKey('cyberpunk')}>go cyber</button>
    </div>
  )
}

describe('applyThemeVars', () => {
  beforeEach(() => { document.documentElement.style.cssText = ''; delete document.documentElement.dataset.themeTexture })
  it('writes accent, chart vars, and texture attr for the resolved mode', () => {
    applyThemeVars(getTheme('cyberpunk'), 'dark')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--color-accent')).toBe('#ff2e88')
    expect(root.style.getPropertyValue('--chart-1')).toBe('#ff2e88')
    expect(root.style.getPropertyValue('--chart-5')).toBe('#39ff9e')
    expect(root.dataset.themeTexture).toBe('scanlines')
  })
})

describe('ThemeSelectionProvider', () => {
  beforeEach(() => localStorage.clear())
  it('defaults to vscode and persists a change to ea-theme-name', () => {
    render(<ThemeSelectionProvider><Probe /></ThemeSelectionProvider>)
    expect(screen.getByTestId('key')).toHaveTextContent('vscode')
    fireEvent.click(screen.getByRole('button', { name: /go cyber/i }))
    expect(screen.getByTestId('key')).toHaveTextContent('cyberpunk')
    expect(localStorage.getItem('ea-theme-name')).toBe('cyberpunk')
  })

  it('restores the stored theme on mount', () => {
    localStorage.setItem('ea-theme-name', 'monokai')
    render(<ThemeSelectionProvider><Probe /></ThemeSelectionProvider>)
    expect(screen.getByTestId('key')).toHaveTextContent('monokai')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && npx vitest run src/themes/ThemeSelectionProvider.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement ThemeSelectionProvider.tsx**

```tsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider, useColorScheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { THEMES, getTheme, DEFAULT_THEME_KEY } from './registry'
import { buildMuiTheme } from './factory'
import { applyThemeVars } from './applyThemeVars'

const KEY = 'ea-theme-name'

interface Selection {
  selectedKey: string
  setThemeKey: (key: string) => void
}

const Ctx = createContext<Selection>({ selectedKey: DEFAULT_THEME_KEY, setThemeKey: () => {} })

export function useThemeSelection(): Selection {
  return useContext(Ctx)
}

// Pushes CSS vars whenever the active theme or resolved mode changes.
function ThemeVarsSync({ selectedKey }: { selectedKey: string }) {
  const { mode, systemMode } = useColorScheme()
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'dark'
  useEffect(() => {
    applyThemeVars(getTheme(selectedKey), resolved === 'light' ? 'light' : 'dark')
  }, [selectedKey, resolved])
  return null
}

export default function ThemeSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedKey, setSelectedKey] = useState<string>(
    () => getTheme(localStorage.getItem(KEY)).key,
  )
  const setThemeKey = (key: string) => {
    const resolved = getTheme(key).key
    setSelectedKey(resolved)
    localStorage.setItem(KEY, resolved)
  }
  const muiTheme = useMemo(() => buildMuiTheme(getTheme(selectedKey)), [selectedKey])

  return (
    <Ctx.Provider value={{ selectedKey, setThemeKey }}>
      <ThemeProvider theme={muiTheme} defaultMode="system" modeStorageKey="ea-theme">
        <CssBaseline />
        <ThemeVarsSync selectedKey={selectedKey} />
        {children}
      </ThemeProvider>
    </Ctx.Provider>
  )
}

// re-export so consumers can enumerate themes for the picker
export { THEMES }
```

- [ ] **Step 4: Wire into main.tsx**

Replace `main.tsx` imports `import { ThemeProvider } from '@mui/material/styles'`, `import CssBaseline from '@mui/material/CssBaseline'`, `import { theme } from './theme'` with `import ThemeSelectionProvider from './themes/ThemeSelectionProvider'`. Replace the `<ThemeProvider …><CssBaseline />…</ThemeProvider>` wrapper with:

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSelectionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeSelectionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 5: Run tests (green) + all three**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green. `theme.ts` is untouched this task (App still calls `loadAccent`, harmless — retired in Task 5). Existing tests importing `{ theme }` from `@/theme` still work.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/themes/ThemeSelectionProvider.tsx frontend/src/themes/applyThemeVars.ts frontend/src/themes/ThemeSelectionProvider.test.tsx frontend/src/main.tsx
git commit -m "feat(frontend): ThemeSelectionProvider — swappable MUI theme + CSS-var/texture sync"
```

---

### Task 3: Per-theme textures

**Files:**
- Create: `frontend/src/themes/textures.css`
- Modify: `frontend/src/index.css` (import textures.css)
- Modify: `frontend/src/App.tsx` (add a texture backdrop layer inside the main content region)

**Interfaces:**
- Consumes: `document.documentElement.dataset.themeTexture` (set by Task 2's `applyThemeVars`).
- Produces: a `.texture-backdrop` element styled per `:root[data-theme-texture="…"]`.

- [ ] **Step 1: Create textures.css**

CSP-safe (inline CSS + inline SVG data-URI noise), subtle, reduced-motion-safe, `pointer-events:none`:

```css
.texture-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.texture-backdrop > * { position: relative; z-index: 1; }

/* mica (VSCode/Win11): faint fractal noise + soft corner tint */
:root[data-theme-texture="mica"] .texture-backdrop {
  background-image:
    radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--color-accent) 6%, transparent), transparent 60%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E");
}
/* scanlines (Cyberpunk): faint horizontal lines + accent glow band up top */
:root[data-theme-texture="scanlines"] .texture-backdrop {
  background-image:
    radial-gradient(80% 40% at 50% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 70%),
    repeating-linear-gradient(0deg, transparent 0 3px, color-mix(in srgb, var(--color-accent-2) 4%, transparent) 3px 4px);
}
/* vignette (Monokai): soft edge darken — editor-flat */
:root[data-theme-texture="vignette"] .texture-backdrop {
  background-image: radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,0.16) 100%);
}
/* grain (Forest): paper noise */
:root[data-theme-texture="grain"] .texture-backdrop {
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)' opacity='0.035'/%3E%3C/svg%3E");
}
/* dots (Vibrant): faint dot field */
:root[data-theme-texture="dots"] .texture-backdrop {
  background-image: radial-gradient(color-mix(in srgb, var(--color-accent) 14%, transparent) 1px, transparent 1.4px);
  background-size: 22px 22px;
}
```

(Note: `color-mix` is supported in the app's evergreen-Chrome target; the build already ships modern CSS.)

- [ ] **Step 2: Import in index.css**

Add near the top of `frontend/src/index.css` (after the font imports): `@import "./themes/textures.css";`

- [ ] **Step 3: Add the backdrop layer in App.tsx**

In `frontend/src/App.tsx`, the main content region is the `<Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>` (center column). Give the routed-content container a positioned wrapper holding a `<div className="texture-backdrop" aria-hidden />` behind `<Routes>`. Concretely, wrap the existing Suspense/RouteErrorBoundary/Routes block so it sits above the backdrop: change the main-view `<Box>` that wraps `<Suspense>` to `sx={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}` and add `<Box className="texture-backdrop" aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} />` as its first child, with the Suspense content given `position: 'relative', zIndex: 1`. Do not place the backdrop over the sidebar or drawer. Read the current App.tsx first and integrate minimally.

- [ ] **Step 4: Reduced-motion + all three**

Confirm no texture animates (all static — safe by default). Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/themes/textures.css frontend/src/index.css frontend/src/App.tsx
git commit -m "feat(frontend): per-theme background textures (mica/scanlines/vignette/grain/dots)"
```

---

### Task 4: Settings theme picker

**Files:**
- Modify: `frontend/src/views/Settings.tsx` (replace accent block with theme cards)
- Modify: `frontend/src/views/Settings.test.tsx`

**Interfaces:**
- Consumes: `useThemeSelection`, `THEMES` (Task 2), MUI `useColorScheme` (existing mode toggle).
- Produces: theme-card picker; the accent-swatch block + its `applyAccent` import/state removed.

- [ ] **Step 1: Read Settings.tsx**, locate the Appearance section's accent-swatch block and its `applyAccent`/`currentAccent` state/effect. Update the test FIRST (TDD): keep the mode→localStorage test; add a theme-picker test.

Add to `frontend/src/views/Settings.test.tsx` (reuse the file's render helper; Settings must render inside `ThemeSelectionProvider` for `useThemeSelection` — wrap the helper accordingly, importing `ThemeSelectionProvider` default from `../themes/ThemeSelectionProvider`):

```tsx
it('theme picker lists all themes and selecting persists', async () => {
  localStorage.clear()
  renderSettings()  // must wrap SettingsView in ThemeSelectionProvider
  const cyber = await screen.findByRole('button', { name: /cyberpunk/i })
  fireEvent.click(cyber)
  await waitFor(() => expect(localStorage.getItem('ea-theme-name')).toBe('cyberpunk'))
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && npx vitest run src/views/Settings.test.tsx`
Expected: FAIL — no theme picker; and (if the helper now wraps in the provider) the accent block references may need removal.

- [ ] **Step 3: Replace the accent block in Settings.tsx**

Remove `import { applyAccent } from '@/theme'`, the `currentAccent` state, and the accent `useEffect`. Add `import { useThemeSelection, THEMES } from '@/themes/ThemeSelectionProvider'`. In the component: `const { selectedKey, setThemeKey } = useThemeSelection()`. Replace the accent-swatch JSX with a theme-card grid (each card is a `button` with an accessible name = the theme label, showing label + mood + a swatch strip of primary/secondary/first-3 cat; selected card outlined):

```tsx
<Box>
  <Typography variant="overline" color="text.secondary">Theme</Typography>
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 1 }}>
    {THEMES.map((t) => {
      const selected = t.key === selectedKey
      const strip = [t.dark.primary, t.dark.secondary, ...t.dark.cat.slice(0, 3)]
      return (
        <Box
          key={t.key}
          component="button"
          aria-label={t.label}
          aria-pressed={selected}
          onClick={() => setThemeKey(t.key)}
          sx={{
            textAlign: 'left', cursor: 'pointer', p: 1.5, borderRadius: 2,
            border: 2, borderColor: selected ? 'primary.main' : 'divider',
            bgcolor: 'background.paper', color: 'text.primary', font: 'inherit',
            display: 'flex', flexDirection: 'column', gap: 0.75,
            '&:hover': { borderColor: 'primary.light' },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.label}</Typography>
          <Typography variant="caption" color="text.secondary">{t.mood}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            {strip.map((c, i) => (
              <Box key={i} sx={{ width: 22, height: 14, borderRadius: 0.5, bgcolor: c }} />
            ))}
          </Box>
        </Box>
      )
    })}
  </Box>
</Box>
```

Keep the existing Mode `ToggleButtonGroup` (dark/light/system) below the theme grid. Keep Notifications untouched.

- [ ] **Step 4: Run tests (green) + all three**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green. If the Settings test's render helper didn't previously wrap in ThemeSelectionProvider, add it (needed for `useThemeSelection`). Keep the existing mode→localStorage assertion.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Settings.tsx frontend/src/views/Settings.test.tsx
git commit -m "feat(frontend): Settings theme-card picker replaces accent swatches"
```

---

### Task 5: Retire accent — shrink theme.ts to a shim

**Files:**
- Modify: `frontend/src/theme.ts` (shrink to re-export shim)
- Delete: `frontend/src/theme.test.ts`
- Modify: `frontend/src/App.tsx` (remove `loadAccent` import + call)

**Interfaces:**
- Consumes: `buildMuiTheme`, `getTheme`, `DEFAULT_THEME_KEY` (Task 1).
- Produces: `theme.ts` exports only `theme` (the default MUI theme) for backward-compat with the ~11 test files importing `{ theme }`.

- [ ] **Step 1: Confirm no remaining accent consumers**

```bash
cd frontend && grep -rn "applyAccent\|loadAccent\|ACCENT_KEY" src --include="*.tsx" --include="*.ts" | grep -v "theme.ts\|theme.test.ts"
```

Expected: only `src/App.tsx` (the `loadAccent()` call — removed this task). Settings' usage was removed in Task 4. If anything else appears, STOP and report.

- [ ] **Step 2: Shrink theme.ts**

Replace the entire contents of `frontend/src/theme.ts` with:

```ts
// Compatibility shim: the default MUI theme, for tests and any legacy import.
// The live app builds themes via themes/ (ThemeSelectionProvider). Accent
// personalization is retired — the theme picker replaces it.
import { buildMuiTheme } from './themes/factory'
import { getTheme, DEFAULT_THEME_KEY } from './themes/registry'

export const theme = buildMuiTheme(getTheme(DEFAULT_THEME_KEY))
```

- [ ] **Step 3: Delete theme.test.ts and remove loadAccent from App.tsx**

```bash
cd frontend && rm src/theme.test.ts
```

In `frontend/src/App.tsx`: remove `import { loadAccent } from '@/theme'` and the `loadAccent()` call inside the mount `useEffect` (leave the rest of that effect — the briefing auto-open logic — intact).

- [ ] **Step 4: All three green**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run build`
Expected: green. The 11 test files importing `{ theme }` still resolve (shim). `grep -rn "applyAccent\|loadAccent\|ACCENT_KEY" src` → only the shim comment / nothing functional.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/theme.ts frontend/src/App.tsx
git rm frontend/src/theme.test.ts
git commit -m "refactor(frontend): retire accent personalization; theme.ts is a default-theme shim"
```

---

### Task 6: Verification — suites + 5-theme visual sweep

**Files:** none.

- [ ] **Step 1: Full suites**

```bash
cd frontend && npx vitest run && npx tsc -b && npm run build
cd ../backend && source ../.venv/bin/activate && python -m pytest -q
```

Expected: FE all green, BE unchanged/green.

- [ ] **Step 2: Deploy + serve the fresh build**

```bash
cd /home/user/code/Scout_EA && docker compose stop web 2>/dev/null || true; pkill -f run_web.py || true
rm -rf frontend_dist && cp -r frontend/dist frontend_dist
source .venv/bin/activate && python -c "import sys; sys.path.insert(0, 'backend'); import seed_demo; seed_demo.seed('ea.sqlite')"
python backend/run_web.py &   # :8765
```

**CRITICAL (learned in Sub-Project A):** a running docker `scout_ea-web-1` container will occupy :8765 and mask your fresh build. Stop it first, then confirm the served bundle hash matches the built one: `curl -s http://localhost:8765/ | grep -oE 'assets/index-[^"]+\.js'` must equal `basename $(ls -t frontend/dist/assets/index-*.js | head -1)`.

- [ ] **Step 3: Playwright — all 5 themes × dark + light**

Script (run from `frontend/`, chromium `/usr/bin/google-chrome`): for each theme key set `localStorage['ea-theme-name']` and `ea-theme` (mode) + `ea-briefing-shown` via addInitScript, load `/`, wait, capture `pageerror` count (must be 0), screenshot `frontend/screenshots/subB-<key>-<mode>.png`. Then load `/settings`, confirm the 5 theme cards render and clicking one persists `ea-theme-name`. Confirm the dashboard charts recolor per theme (compare a KPI sparkline / trending bar fill across two themes) and the texture backdrop is present (element `.texture-backdrop` exists, `data-theme-texture` attr matches the theme).

- [ ] **Step 4: Kill server, record**

```bash
pkill -f run_web.py
```

Record: 0 pageerrors across all 10 theme×mode loads; each theme's `data-theme-texture` correct; picker persists. Note bundle size delta.

- [ ] **Step 5: Merge + refresh container**

Merge `subproject-b-theme-system` to master (no-ff), CI green. Then rebuild + restart the web container (`docker compose build web && docker compose up -d web`) so the running app reflects the themes; confirm served bundle matches.

---

## Self-Review Notes

- Spec coverage: registry+factory+5 themes (T1), selection provider + var/texture sync + main.tsx swap (T2), per-theme textures (T3), Settings picker + accent removal (T4), accent retirement + theme.ts shim (T5), verification (T6). Chart-var wiring is folded into T2's `applyThemeVars` (`--chart-1..5` + `--color-accent`); existing single-series charts already read `--color-accent`, so no separate chart task is needed — noted as a deliberate scope call.
- Deviation (documented in Global Constraints + T5): spec said delete theme.ts; plan keeps a re-export shim because 11 test files import `{ theme }` — deleting would balloon the diff for no benefit.
- Ordering: T2 depends on T1; T3 depends on T2's `data-theme-texture`; T4 depends on T2's `useThemeSelection`; T5 depends on T4 having removed Settings' `applyAccent`. Linear order 1→6 satisfies all.
- Type consistency: `ThemeDef`/`ThemeTokens`/`TextureId` (T1) consumed everywhere; `buildMuiTheme`, `getTheme`, `DEFAULT_THEME_KEY`, `THEMES` (T1) used in T2/T5; `applyThemeVars(def, mode)` (T2) signature matches its test; `useThemeSelection()` shape `{selectedKey, setThemeKey}` consistent T2→T4.
- Palettes are validator-locked (CVD + contrast pass both modes); the two ~0.09-chroma light hues rely on mandatory bar labels — documented tradeoff, not a silent one.
