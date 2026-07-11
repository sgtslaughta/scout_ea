# Sub-Project B — Multi-Theme System + Character — Design

**Date:** 2026-07-11
**Status:** Approved (design); palettes validator-locked.
**Program:** dashboard overhaul, sub-project B of 6 (`2026-07-11-dashboard-overhaul-design.md`).

## Goal

Replace the single-palette + free-form accent picker with **5 curated, user-selectable themes**, each with dark + light variants and its own signature texture. Ship a Settings theme picker. Every theme's chart set is colorblind-safe and contrast-checked in both modes.

## Decisions (user-locked)

- Ship all 5 themes as user choices (not pick-one).
- Accent-swatch personalization is **retired** — the theme picker is the personalization.
- Every theme supports **both** dark + light.
- **Distinct texture per theme** (not one universal treatment).
- Default theme: **VSCode / Win11 Fluent**.

## Architecture

### Theme registry (extensible — new theme = 1 file + 1 line)

`frontend/src/themes/` :
- `types.ts` — `ThemeTokens` (one mode's colors) and `ThemeDef`:
  ```ts
  interface ThemeTokens {
    bg: string; paper: string; divider: string
    textPrimary: string; textSecondary: string
    primary: string; onPrimary: string; secondary: string
    error: string; warning: string; success: string; info: string
    cat: [string, string, string, string, string]  // categorical chart hues
  }
  interface ThemeDef {
    key: string          // 'vscode' | 'cyberpunk' | 'monokai' | 'forest' | 'vibrant'
    label: string        // 'VSCode / Win11 Fluent'
    mood: string         // one-line descriptor for the picker card
    texture: TextureId   // 'mica' | 'scanlines' | 'vignette' | 'grain' | 'dots'
    dark: ThemeTokens
    light: ThemeTokens
  }
  ```
- `<theme>.ts` per theme (5 files), each exporting one `ThemeDef` with the locked tokens below.
- `registry.ts` — `export const THEMES: ThemeDef[]` (order = picker order); `DEFAULT_THEME_KEY = 'vscode'`; `getTheme(key)` with fallback to default.
- `factory.ts` — `buildMuiTheme(def: ThemeDef)`: returns a MUI `createTheme` with `cssVariables` + both `colorSchemes` (dark/light) mapped from `def.dark`/`def.light` tokens. Typography/shape unchanged from today.

### Selection layer

`frontend/src/themes/ThemeSelectionProvider.tsx`:
- Holds `selectedKey` (init from `localStorage['ea-theme-name']`, default `vscode`).
- Renders `<ThemeProvider theme={muiTheme} defaultMode="system" modeStorageKey="ea-theme">` + `<CssBaseline>`, wrapping `<App/>`, where `const muiTheme = useMemo(() => buildMuiTheme(getTheme(selectedKey)), [selectedKey])` (memoized so it rebuilds only on theme change, not every render). Replaces the static ThemeProvider currently in `main.tsx`.
- On mount and on every `selectedKey`/mode change, pushes CSS variables (see Chart wiring) and sets `document.documentElement.dataset.themeTexture = def.texture`.
- Context exposes `{ selectedKey, setThemeKey(key) }` via `useThemeSelection()` hook; persists on set.
- Mode (dark/light/system) stays owned by MUI `useColorScheme` + the existing `ea-theme` key — unchanged.

### Persistence contracts

- `ea-theme` — mode (dark/light/system), existing, unchanged.
- `ea-theme-name` — **new** — selected theme key.
- `ea-accent` — **retired**; `applyAccent`/`loadAccent` in `theme.ts` removed. `theme.ts` is superseded by `themes/` (delete after migration; keep nothing importing it).

### Chart / CSS-var wiring

The provider writes these on `<html>` whenever theme or resolved mode changes (so charts + horizon bar + any raw-CSS consumer track the active theme):
- `--color-accent` = active tokens `.primary`
- `--color-accent-2` = active tokens `.secondary`
- `--chart-1..--chart-5` = active tokens `.cat[0..4]`

Chart components switch from the single `var(--color-accent)` series color to reading `--chart-N` for multi-series (single-series charts keep `--color-accent`). Existing widgets that hardcode `var(--color-accent)` keep working.

### Settings rebuild (Appearance section)

`frontend/src/views/Settings.tsx` Appearance section becomes:
- **Theme** — a row/grid of 5 selectable cards, each showing the theme label, mood, and a small swatch strip (primary, secondary, 3 cat hues) rendered in the card. Selected card is outlined (`primary.main`). Click → `setThemeKey(key)`.
- **Mode** — the existing dark/light/system `ToggleButtonGroup` (unchanged).
- Remove the accent-swatch block + its `applyAccent` import and state.
- Notifications section unchanged.

### Per-theme textures (`TextureId` → CSS)

A single `frontend/src/themes/textures.css` (or sx in a `<TextureBackdrop>` component) keyed on `:root[data-theme-texture="…"]`. All CSP-safe (inline CSS or inline SVG data-URI noise — no external assets), all `@media (prefers-reduced-motion: reduce)` disabling any animation, all subtle (low opacity, applied to app background / empty regions, never over text or data):
- `mica` (VSCode/Win11) — very low-opacity SVG fractal-noise + a soft radial tint toward the corner; static.
- `scanlines` (Cyberpunk) — faint repeating-linear-gradient horizontal lines (~2px, ~4% opacity) + a subtle primary-colored glow behind the top bar; static (no flicker — reduced-motion and taste).
- `vignette` (Monokai) — a soft radial darken/warm at the edges; deliberately minimal (editor-flat).
- `grain` (Forest) — low-opacity SVG noise (paper grain), static.
- `dots` (Vibrant) — a faint radial-gradient dot field (large spacing, ~5% opacity).

Textures render behind content via a fixed, `pointer-events:none`, `z-index:-1`/`0` backdrop layer inside the main content region — must not intercept clicks or hurt scroll perf (fixed attachment, GPU-cheap).

## The 5 themes (validator-locked hexes)

All categorical sets pass **CVD separation** and **contrast ≥ 3:1** in both modes (validated via dataviz `validate_palette.js`). Charts always direct-label (`barLabel="value"`), the sanctioned secondary encoding. Two light-mode hues (Forest teal/plum, VSCode teal) sit at ~0.09 OKLCH chroma — a hair under the "reads-gray" floor, an accepted tradeoff since a dark-enough-for-white-contrast teal can't hold higher chroma; the mandatory bar labels carry identity there. Text-secondary (`dim`) values that fail WCAG on their surface get nudged during implementation.

Token order: bg · paper · divider · textPrimary · textSecondary · primary · onPrimary · secondary · [err,warn,ok,info] · cat[5]

### 1. VSCode / Win11 Fluent — texture `mica` — **default**
- **dark:** `#1e1e1e` · `#252526` · `#333333` · `#d4d4d4` · `#858585` · `#3794ff` · `#04121f` · `#4ec9b0` · [`#f14c4c`,`#cca700`,`#89d185`,`#3794ff`] · [`#3794ff`,`#4ec9b0`,`#dd9a5f`,`#d4c96a`,`#c586c0`]
- **light:** `#f3f3f3` · `#ffffff` · `#e5e5e5` · `#1f1f1f` · `#616161` · `#005fb8` · `#ffffff` · `#007a6e` · [`#d13438`,`#9d5d00`,`#107c10`,`#005fb8`] · [`#005fb8`,`#c0491a`,`#0e7a6b`,`#8764b8`,`#107c10`]

### 2. Cyberpunk — texture `scanlines`
- **dark:** `#0a0612` · `#140a1f` · `#2a1740` · `#f0e6ff` · `#9a7fb8` · `#ff2e88` · `#12000a` · `#00e5ff` · [`#ff3860`,`#ffb000`,`#39ff9e`,`#00e5ff`] · [`#ff2e88`,`#00e5ff`,`#b14aff`,`#ffdd00`,`#39ff9e`]
- **light:** `#f6f0fb` · `#ffffff` · `#ece0f5` · `#1a0b26` · `#6e5a80` · `#d6006e` · `#ffffff` · `#0088a8` · [`#e0114f`,`#c77b00`,`#0a9d5a`,`#0088a8`] · [`#d6006e`,`#0088a8`,`#8b2fd6`,`#b58900`,`#0a9d5a`]

### 3. Dark Monokai — texture `vignette`
- **dark:** `#22231e` · `#2c2d26` · `#3a3b32` · `#f8f8f2` · `#a59f8a` · `#f92672` · `#1a0410` · `#66d9ef` · [`#f92672`,`#fd971f`,`#a6e22e`,`#66d9ef`] · [`#f92672`,`#a6e22e`,`#66d9ef`,`#ae81ff`,`#fd971f`]
- **light:** `#fafaf5` · `#ffffff` · `#e8e6d8` · `#272822` · `#6a6550` · `#d81b60` · `#ffffff` · `#0089a6` · [`#d81b60`,`#c46a10`,`#6a9c11`,`#0089a6`] · [`#d81b60`,`#6a9c11`,`#0089a6`,`#8b52d6`,`#c46a10`]

### 4. Forest Earthy — texture `grain`
- **dark:** `#10150f` · `#191f16` · `#262e20` · `#e9ede3` · `#9aa890` · `#86bf6b` · `#0e1a0a` · `#e0925b` · [`#d9705e`,`#e0b24a`,`#86bf6b`,`#6fb0a0`] · [`#7dbf5f`,`#31b39a`,`#e0b23a`,`#e07a45`,`#b579b0`]
- **light:** `#f5f7ef` · `#ffffff` · `#e1e6d5` · `#1b2415` · `#5c6650` · `#47762c` · `#ffffff` · `#b5652a` · [`#b8402e`,`#9a7318`,`#47762c`,`#2f7d70`] · [`#3f7a2c`,`#b8461c`,`#0e7a6b`,`#7d4a7a`,`#8a6a10`]

### 5. Vibrant Playful — texture `dots`
- **dark:** `#17121e` · `#221a2c` · `#322842` · `#f4effa` · `#b3a6c6` · `#ff6b6b` · `#2a0f0f` · `#c084fc` · [`#ff6b6b`,`#fbbf24`,`#34d399`,`#60a5fa`] · [`#ff6b6b`,`#c084fc`,`#2dd4bf`,`#fbbf24`,`#60a5fa`]
- **light:** `#fdf5fa` · `#ffffff` · `#f0deec` · `#2a1936` · `#6e5a7e` · `#e0286e` · `#ffffff` · `#8b3fd6` · [`#d61f5c`,`#d97706`,`#0e9f6e`,`#2f6fd6`] · [`#e0286e`,`#8b3fd6`,`#0d9488`,`#d97706`,`#2f6fd6`]

## Testing

- **Registry completeness:** every `ThemeDef` has both modes fully populated, a 5-hue `cat`, a valid `texture` id; keys unique; default key resolves.
- **Factory:** `buildMuiTheme` produces a theme whose `colorSchemes.dark/light.palette.primary.main` match the def; cssVariables enabled.
- **Selection:** `setThemeKey` swaps the MUI palette, persists to `ea-theme-name`, and updates `--chart-1..5` + `--color-accent` on `<html>`; unknown stored key → default.
- **Settings picker:** renders 5 cards, selected outlined; clicking a card changes the theme; mode toggle still works.
- **Textures:** `data-theme-texture` attribute tracks the active theme; texture layer is `pointer-events:none`.
- **Palette validation:** a test (or committed script output) asserts each theme's cat set passes CVD + contrast — regenerate via dataviz validator.
- Every change: `npx vitest run`, `npx tsc -b`, `npm run build` green; backend untouched.
- Visual: screenshot all 5 themes × dark+light on the dashboard; confirm textures render subtly, charts recolor, picker works.

## Migration notes

- `theme.ts` (single theme + accent fns) is replaced by `themes/`; delete once nothing imports it (`applyAccent`/`loadAccent`/`ACCENT_KEY` consumers: `main.tsx`, `App.tsx` `loadAccent()` call, `Settings.tsx` accent block, any test importing `@/theme`). Provide the new imports (`buildMuiTheme`, `getTheme`, `THEMES`, `useThemeSelection`).
- `index.css` `--color-accent`/`--color-accent-2` defaults stay (fallback before JS boots); the provider overwrites them per theme.
- Existing per-view/widget code reading `var(--color-accent)` needs no change.

## Out of scope (later sub-projects)

DataGrid-everywhere + task editing (C), workday bar (D), search (E), kanban (F). Multi-series chart recoloring uses `--chart-N` here, but converting specific existing single-series charts to multi-series is not in B unless trivial.
