# Briefing Sky & Legibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken celestial arc, extend the day/night sky to the whole briefing modal background, and make every surface legible in both light and dark mode.

**Architecture:** The arc bug is fixed first in `WeatherBand` so the larger surface does not inherit it. The sky gradient then moves out of the 120px weather band into a standalone `SkyBackdrop` component rendered behind the modal content. Cards become translucent so the sky reads through, and the weather text gets a scrim so it stays readable against a bright daytime gradient.

**Tech Stack:** React 19, TypeScript, MUI v7 (`sx` props, palette tokens, `useColorScheme`), Vitest + Testing Library.

## Global Constraints

- Slice 1 of 3 from `docs/superpowers/specs/2026-07-25-briefing-polish-design.md`.
- Verify the frontend with `npm run build` (runs `tsc -b`, strict). Do NOT use `tsc --noEmit`.
- Run frontend tests with `cd frontend && npx vitest run`.
- Every color except the four sky phase gradients must come from MUI palette tokens, never a hardcoded hex.
- All animation must be disabled under `@media (prefers-reduced-motion: reduce)`.
- Primary text must clear WCAG AA (4.5:1) against its backing in both modes and all four sky phases.
- Do not touch `schedule:` frontmatter in any `SKILL.md` — it is load-bearing for `skill_health`.

---

### Task 1: Fix the celestial arc letterboxing

The SVG at `frontend/src/components/weather/WeatherBand.tsx:94-102` has `viewBox="0 0 100 40"` and `width:100% height:100%` with no `preserveAspectRatio`. The SVG default is `xMidYMid meet`, which scales the viewBox to fit *entirely* inside the element and centers it. The viewBox is 2.5:1 and the band is roughly 8:1, so the arc renders as a ~300px strip centered in a ~1000px band — the sun never reaches either horizon.

**Files:**
- Modify: `frontend/src/components/weather/WeatherBand.tsx:94-102`
- Test: `frontend/src/components/weather/WeatherBand.test.tsx`

**Interfaces:**
- Consumes: `skyPhase`, `arcFraction` from `./sky` (unchanged signatures).
- Produces: nothing new; this is a defect fix.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/weather/WeatherBand.test.tsx`:

```tsx
it('stretches the celestial arc across the full band width', () => {
  const { container } = render(
    <WeatherBand
      weather={{
        temp: 20, condition: 'clear', is_day: true, unit: 'C', label: 'Test',
        sunrise: '2026-07-25T06:00:00Z', sunset: '2026-07-25T20:00:00Z',
      }}
      now={new Date('2026-07-25T13:00:00Z')}
    />,
  )
  const svg = container.querySelector('svg')
  // Without this, xMidYMid meet letterboxes the arc into a narrow centered strip.
  expect(svg?.getAttribute('preserveAspectRatio')).toBe('none')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run WeatherBand`
Expected: FAIL — received `null` (the attribute is absent).

- [ ] **Step 3: Add the attribute**

In `WeatherBand.tsx`, on the `<svg>` opening tag at line ~94, add `preserveAspectRatio="none"` immediately after `viewBox`:

```tsx
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        style={{
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run WeatherBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/weather/WeatherBand.tsx frontend/src/components/weather/WeatherBand.test.tsx
git commit -m "fix(weather): stretch celestial arc to full band width

The arc SVG had no preserveAspectRatio, so the default xMidYMid meet
letterboxed a 2.5:1 viewBox inside an ~8:1 band — the sun traversed only
the middle third and never reached the horizons."
```

---

### Task 2: Derive sun-vs-moon from the live phase, not the cached `is_day`

`weather.is_day` comes from the server's 30-minute-cached Open-Meteo response, while `phase` is recomputed from a live clock that ticks every 60s (`WeatherBand.tsx:22-28`). Near sunrise/sunset they disagree, so a moon can render over a daytime gradient. `arcFraction` also takes its `isDay` argument from the same stale field.

**Files:**
- Modify: `frontend/src/components/weather/WeatherBand.tsx:34-37, 111-133`
- Test: `frontend/src/components/weather/WeatherBand.test.tsx`

**Interfaces:**
- Consumes: `skyPhase(now, sunrise, sunset) -> 'dawn'|'day'|'dusk'|'night'` from `./sky`.
- Produces: a local `const isNight = phase === 'night'` used for both the arc fraction and the celestial body choice.

- [ ] **Step 1: Write the failing test**

Add to `WeatherBand.test.tsx`:

```tsx
it('renders the moon at night even when cached is_day is stale-true', () => {
  render(
    <WeatherBand
      weather={{
        temp: 12, condition: 'clear',
        is_day: true,  // stale: server cached this up to 30 min ago
        unit: 'C', label: 'Test',
        sunrise: '2026-07-25T06:00:00Z', sunset: '2026-07-25T20:00:00Z',
      }}
      now={new Date('2026-07-25T23:00:00Z')}  // clearly night
    />,
  )
  expect(screen.getByTestId('celestial-moon')).toBeInTheDocument()
  expect(screen.queryByTestId('celestial-sun')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run WeatherBand`
Expected: FAIL — `celestial-moon` not found, because `weather.is_day === true` selects the sun.

- [ ] **Step 3: Derive from phase**

In `WeatherBand.tsx`, after the `phase` useMemo (line ~33), add:

```tsx
  // The gradient uses the live clock, so the celestial body must too — `weather.is_day`
  // is a server-cached snapshot (30 min TTL) and disagrees near sunrise/sunset.
  const isNight = phase === 'night'
```

Change the `arcPos` useMemo to pass `!isNight` instead of `weather.is_day ?? true`:

```tsx
  const arcPos = useMemo(
    () => arcFraction(now, weather.sunrise || new Date(), weather.sunset || new Date(), !isNight),
    [now, weather.sunrise, weather.sunset, isNight],
  )
```

Change the celestial body conditional (line ~111) from `{weather.is_day ? (` to:

```tsx
        {!isNight ? (
```

Leave `<ConditionFX ... isDay={weather.is_day ?? true} />` alone — the weather effects key off reported conditions, not the arc.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run WeatherBand`
Expected: PASS, and the Task 1 test still passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/weather/WeatherBand.tsx frontend/src/components/weather/WeatherBand.test.tsx
git commit -m "fix(weather): pick sun/moon from live phase, not cached is_day"
```

---

### Task 3: Extract `SkyBackdrop` as a standalone component

**Files:**
- Create: `frontend/src/components/weather/SkyBackdrop.tsx`
- Create: `frontend/src/components/weather/SkyBackdrop.test.tsx`
- Modify: `frontend/src/components/weather/WeatherBand.tsx:11-17, 85-92`

**Interfaces:**
- Consumes: `SkyPhase` type from `./sky`.
- Produces: `<SkyBackdrop phase={SkyPhase} fade?: boolean />` — an absolutely-positioned `inset: 0` element painting the phase gradient. `fade` (default `false`) adds a downward fade to transparent, used when it backs the whole modal. Also exports `skyGradients: Record<SkyPhase, string>`.

The dark-mode muting is an overlay composited on top of the same four gradients, so night in dark mode is the same sky at lower luminance rather than a second palette to maintain.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/weather/SkyBackdrop.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { SkyBackdrop, skyGradients } from './SkyBackdrop'

describe('SkyBackdrop', () => {
  it('paints the gradient for the given phase', () => {
    const { container } = render(<SkyBackdrop phase="dusk" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveStyle({ position: 'absolute' })
    expect(skyGradients.dusk).toContain('linear-gradient')
  })

  it('exposes a gradient for every phase', () => {
    expect(Object.keys(skyGradients).sort()).toEqual(['dawn', 'day', 'dusk', 'night'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run SkyBackdrop`
Expected: FAIL — cannot resolve `./SkyBackdrop`.

- [ ] **Step 3: Create the component**

Create `frontend/src/components/weather/SkyBackdrop.tsx`:

```tsx
import { Box } from '@mui/material'
import type { SkyPhase } from './sky'

/** Sky gradient presets by phase. Intentionally hardcoded — a sky is not a theme color. */
export const skyGradients: Record<SkyPhase, string> = {
  dawn: 'linear-gradient(180deg, #ffc2a6 0%, #ffb380 50%, #a8d8ff 100%)',
  day: 'linear-gradient(180deg, #87ceeb 0%, #e0f6ff 100%)',
  dusk: 'linear-gradient(180deg, #ff9a56 0%, #c66dd4 50%, #2a1b4d 100%)',
  night: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0d0a1a 100%)',
}

export interface SkyBackdropProps {
  phase: SkyPhase
  /** Fade the sky out toward the bottom, so content below sits on near-neutral ground. */
  fade?: boolean
}

const FADE_MASK = 'linear-gradient(180deg, #000 0%, #000 45%, transparent 100%)'

export function SkyBackdrop({ phase, fade = false }: SkyBackdropProps) {
  return (
    <Box
      aria-hidden
      data-testid="sky-backdrop"
      data-phase={phase}
      sx={(theme) => ({
        position: 'absolute',
        inset: 0,
        background: skyGradients[phase] || skyGradients.day,
        pointerEvents: 'none',
        ...(fade && { maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }),
        // Dark mode: the same sky at lower luminance — an overlay, not a second palette.
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundColor: theme.palette.common.black,
          opacity: 0,
          ...theme.applyStyles('dark', { opacity: 0.55 }),
        },
      })}
    />
  )
}
```

`theme.applyStyles('dark', ...)` is the MUI v7 way to branch on color scheme when
`cssVariables` is enabled — this project enables it in `themes/factory.ts:20-36`,
so a plain `theme.palette.mode` check would not react to runtime scheme changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run SkyBackdrop`
Expected: PASS

- [ ] **Step 5: Use it inside WeatherBand**

In `WeatherBand.tsx`, delete the local `skyGradients` const (lines 11-17) and import from the new module:

```tsx
import { SkyBackdrop } from './SkyBackdrop'
```

Replace the inline SkyBackdrop `<Box>` (lines ~85-92) with:

```tsx
      <SkyBackdrop phase={phase} />
```

- [ ] **Step 6: Run the full frontend suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/weather/SkyBackdrop.tsx frontend/src/components/weather/SkyBackdrop.test.tsx frontend/src/components/weather/WeatherBand.tsx
git commit -m "refactor(weather): extract SkyBackdrop with dark-mode muting"
```

---

### Task 4: Add a scrim behind the weather text

White text on the daytime gradient (`#87ceeb` → `#e0f6ff`) fails contrast; `text-shadow` alone is not enough.

**Files:**
- Modify: `frontend/src/components/weather/WeatherBand.tsx` (the content overlay `Box` at line ~139)
- Test: `frontend/src/components/weather/WeatherBand.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `data-testid="weather-scrim"` element the test asserts on.

- [ ] **Step 1: Write the failing test**

```tsx
it('renders a scrim behind the location and temperature', () => {
  render(
    <WeatherBand
      weather={{
        temp: 30, condition: 'clear', is_day: true, unit: 'F', label: 'Austin',
        sunrise: '2026-07-25T06:00:00Z', sunset: '2026-07-25T20:00:00Z',
      }}
      now={new Date('2026-07-25T12:00:00Z')}
    />,
  )
  expect(screen.getByTestId('weather-scrim')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run WeatherBand`
Expected: FAIL — unable to find `weather-scrim`.

- [ ] **Step 3: Add the scrim**

In `WeatherBand.tsx`, immediately before the Content Overlay `<Box>` (the one with `position: 'absolute', bottom: 12`), insert:

```tsx
      {/* Scrim — keeps white text legible against a bright daytime sky */}
      <Box
        aria-hidden
        data-testid="weather-scrim"
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 45%, transparent 75%)',
        }}
      />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run WeatherBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/weather/WeatherBand.tsx frontend/src/components/weather/WeatherBand.test.tsx
git commit -m "fix(weather): scrim behind location + temp for daytime legibility"
```

---

### Task 5: Make the sky the modal background and cards translucent

**Files:**
- Modify: `frontend/src/components/TodayBriefing.tsx:32-44` (the `Section` component), `:88-106` (the Dialog + content)
- Test: `frontend/src/components/TodayBriefing.test.tsx`

**Interfaces:**
- Consumes: `SkyBackdrop` from `./weather/SkyBackdrop`, `skyPhase` from `./weather/sky`.
- Produces: a full-bleed sky behind the modal content; `Section` cards rendered translucent.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/TodayBriefing.test.tsx` (follow the existing render/mock setup in that file — it already mocks `@/api`):

```tsx
it('renders the sky backdrop behind the modal content', async () => {
  renderBriefing({ open: true })   // existing helper in this file
  expect(await screen.findByTestId('sky-backdrop')).toBeInTheDocument()
})
```

If the file has no `renderBriefing` helper, render `<TodayBriefing open onClose={() => {}} />` inside the same providers the other tests in the file use.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run TodayBriefing`
Expected: FAIL — unable to find `sky-backdrop`.

- [ ] **Step 3: Add the backdrop and make cards translucent**

In `TodayBriefing.tsx`, add imports:

```tsx
import { SkyBackdrop } from './weather/SkyBackdrop'
import { skyPhase } from './weather/sky'
```

Inside the component, after the `finance` query, derive the phase from the weather payload:

```tsx
  // Sky phase drives the whole modal background, not just the weather band.
  const phase = weather?.sunrise && weather?.sunset
    ? skyPhase(new Date(), weather.sunrise, weather.sunset)
    : 'day'
```

Inside the Dialog, as the first child of the outer content `<Box>` (before the close button), add:

```tsx
        <SkyBackdrop phase={phase} fade />
```

The content `Box` at line 90 needs `position: 'relative'` and a stacking context so content sits above the backdrop. Change its `sx` to:

```tsx
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column',
                 overflow: 'auto', position: 'relative' }}>
```

and give the close button and every sibling after the backdrop `zIndex: 1` — the close button already has it; wrap the remaining content in a `<Box sx={{ position: 'relative', zIndex: 1 }}>` so it layers above the sky.

Change the `Section` `Paper` (line 35) from `bgcolor: 'action.hover'` to a translucent, blurred surface:

```tsx
    <Paper
      sx={(theme) => ({
        p: 2,
        // Translucent so the sky reads through; blur keeps text contrast.
        backgroundColor: alpha(theme.palette.background.paper, 0.72),
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: 'divider',
      })}
    >
```

Add `alpha` to the MUI import:

```tsx
import { Dialog, Box, Typography, Stack, Paper, IconButton, Skeleton, alpha } from '@mui/material'
```

Apply the same translucency to the `FinanceStrip` container in `FinanceStrip.tsx:104` — change `bgcolor: 'background.paper'` to the same `alpha(...)` treatment so it matches the cards.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run TodayBriefing`
Expected: PASS

- [ ] **Step 5: Run the full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Verify contrast by eye in a real browser**

Run the app, open the briefing modal, and toggle light/dark. Confirm in both modes: the location and temperature are readable, card body text is readable, and the sun/moon travels the full width of the band. Check at least one daytime and one nighttime phase (temporarily pass a fixed `now` if needed).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/TodayBriefing.tsx frontend/src/components/TodayBriefing.test.tsx frontend/src/components/finance/FinanceStrip.tsx
git commit -m "feat(briefing): full-bleed day/night sky with translucent cards"
```

---

## Self-Review Notes

- **Spec coverage:** arc fix (T1, T2), sky spans the modal (T3, T5), dark-mode muting (T3), weather legibility (T4), translucent cards (T5), theme compliance (T3, T5). All of spec sections C and D are covered.
- **Deferred:** the WCAG AA contrast floor is verified by eye in T5 Step 6 rather than by an automated contrast assertion — jsdom does not composite layers, so an automated check here would assert nothing real.
- **Type consistency:** `SkyPhase`, `skyGradients`, `SkyBackdrop`, `phase`, `isNight` used identically across tasks.
