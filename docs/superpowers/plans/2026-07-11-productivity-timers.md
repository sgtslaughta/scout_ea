# Productivity Timers (SP-B1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A client-side countdown + stopwatch in a new Quickdraw "Timers" section, anchored on wall-clock timestamps so it survives reload and navigation.

**Architecture:** Pure timestamp math in `lib/timers.ts` (no React), wrapped by a `useTimers` hook that adds a 250 ms render tick and `localStorage` persistence. The countdown's zero-crossing fires a shared `playChime` (extracted from `useAlertChime`) + a toast + an optional browser Notification. UI is `TimersSection` rendered via the existing `QuickdrawSection` shell.

**Tech Stack:** React 19 / MUI v7 / TypeScript / Vitest / lucide-react / sonner. No backend, no new dependency.

## Global Constraints

- No backend, no new tables/endpoints, no new dependency.
- State truth is epoch-ms timestamps, never a decrementing counter. All pure fns take an explicit `now`.
- Single `localStorage` key: `ea-timers`, value `{countdown, stopwatch}` JSON.
- One countdown + one stopwatch only (no multi-timer list, no pomodoro cycles — out of scope).
- Countdown finish effect fires exactly once: `playChime()` + `toast.success('Timer done')` + `new Notification(...)` only if `Notification.permission === 'granted'` (never prompt on finish).
- `playChime` lives in `frontend/src/lib/chime.ts` (extracted); `useAlertChime.ts` imports it. Behavior unchanged.
- Countdown quick-set presets: 5 / 10 / 25 minutes. Default idle countdown = 5:00 (300000 ms).

---

### Task 1: Pure timer core

**Files:**
- Create: `frontend/src/lib/timers.ts`
- Test: `frontend/src/lib/timers.test.ts`

**Interfaces:**
- Produces: `CountdownState`, `StopwatchState` types; `remainingMs(s,now)`, `elapsedMs(s,now)`, `startCountdown(s,now)`, `pauseCountdown(s,now)`, `resetCountdown(durationMs)`, `startStopwatch(s,now)`, `pauseStopwatch(s,now)`, `resetStopwatch()`, `formatClock(ms)`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/timers.test.ts`:

```ts
import { it, expect } from 'vitest'
import * as T from './timers'

it('remainingMs: running derives from endsAt; paused uses stored', () => {
  expect(T.remainingMs({ endsAt: 1000, remainingMs: 999, running: true }, 400)).toBe(600)
  expect(T.remainingMs({ endsAt: 1000, remainingMs: 999, running: true }, 2000)).toBe(0) // clamped
  expect(T.remainingMs({ endsAt: null, remainingMs: 777, running: false }, 500)).toBe(777)
})

it('elapsedMs: running adds current segment; paused uses accumulated', () => {
  expect(T.elapsedMs({ startedAt: 100, accumulatedMs: 50, running: true }, 400)).toBe(350)
  expect(T.elapsedMs({ startedAt: null, accumulatedMs: 50, running: false }, 400)).toBe(50)
})

it('startCountdown arms endsAt = now + remaining', () => {
  const s = T.startCountdown({ endsAt: null, remainingMs: 5000, running: false }, 1000)
  expect(s).toEqual({ endsAt: 6000, remainingMs: 5000, running: true })
})

it('startCountdown no-ops when already running or nothing left', () => {
  const run = { endsAt: 6000, remainingMs: 5000, running: true }
  expect(T.startCountdown(run, 2000)).toBe(run)
  const zero = { endsAt: null, remainingMs: 0, running: false }
  expect(T.startCountdown(zero, 2000)).toBe(zero)
})

it('pauseCountdown banks remaining and clears endsAt', () => {
  const s = T.pauseCountdown({ endsAt: 6000, remainingMs: 5000, running: true }, 2000)
  expect(s).toEqual({ endsAt: null, remainingMs: 4000, running: false })
})

it('resetCountdown yields idle with given duration', () => {
  expect(T.resetCountdown(300000)).toEqual({ endsAt: null, remainingMs: 300000, running: false })
})

it('stopwatch start/pause banks accumulated across segments', () => {
  let s = T.resetStopwatch()
  s = T.startStopwatch(s, 1000)
  s = T.pauseStopwatch(s, 3000)          // +2000
  expect(s.accumulatedMs).toBe(2000)
  s = T.startStopwatch(s, 5000)
  s = T.pauseStopwatch(s, 6000)          // +1000
  expect(s.accumulatedMs).toBe(3000)
})

it('formatClock', () => {
  expect(T.formatClock(0)).toBe('00:00')
  expect(T.formatClock(65_000)).toBe('01:05')
  expect(T.formatClock(3_600_000)).toBe('1:00:00')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/timers.test.ts`
Expected: FAIL — cannot resolve `./timers`.

- [ ] **Step 3: Create `frontend/src/lib/timers.ts`**

```ts
export interface CountdownState {
  endsAt: number | null   // epoch ms it will reach zero; null when paused/idle
  remainingMs: number     // authoritative when paused; also the last-set duration
  running: boolean
}
export interface StopwatchState {
  startedAt: number | null   // epoch ms of the current run segment; null when paused
  accumulatedMs: number      // banked from prior segments
  running: boolean
}

export function remainingMs(s: CountdownState, now: number): number {
  return s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.remainingMs
}
export function elapsedMs(s: StopwatchState, now: number): number {
  return s.running && s.startedAt !== null ? s.accumulatedMs + (now - s.startedAt) : s.accumulatedMs
}

export function startCountdown(s: CountdownState, now: number): CountdownState {
  if (s.running || s.remainingMs <= 0) return s
  return { endsAt: now + s.remainingMs, remainingMs: s.remainingMs, running: true }
}
export function pauseCountdown(s: CountdownState, now: number): CountdownState {
  if (!s.running) return s
  return { endsAt: null, remainingMs: remainingMs(s, now), running: false }
}
export function resetCountdown(durationMs: number): CountdownState {
  return { endsAt: null, remainingMs: durationMs, running: false }
}

export function startStopwatch(s: StopwatchState, now: number): StopwatchState {
  if (s.running) return s
  return { startedAt: now, accumulatedMs: s.accumulatedMs, running: true }
}
export function pauseStopwatch(s: StopwatchState, now: number): StopwatchState {
  if (!s.running) return s
  return { startedAt: null, accumulatedMs: elapsedMs(s, now), running: false }
}
export function resetStopwatch(): StopwatchState {
  return { startedAt: null, accumulatedMs: 0, running: false }
}

export function formatClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/timers.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/timers.ts frontend/src/lib/timers.test.ts
git commit -m "feat(timers): pure countdown/stopwatch timestamp core"
```

---

### Task 2: Shared chime extraction + useTimers hook

**Files:**
- Create: `frontend/src/lib/chime.ts`
- Modify: `frontend/src/lib/useAlertChime.ts:27-57` (remove local `playChime`, import from `./chime`)
- Create: `frontend/src/lib/useTimers.ts`
- Test: `frontend/src/lib/useTimers.test.ts`

**Interfaces:**
- Consumes: everything from `lib/timers.ts` (Task 1).
- Produces: `playChime(): void` from `lib/chime.ts`; `useTimers()` returning
  `{ remaining, elapsed, countdownRunning, stopwatchRunning, startCountdown, pauseCountdown, resetCountdown(ms), startStopwatch, pauseStopwatch, resetStopwatch }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/useTimers.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { vi, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./chime', () => ({ playChime: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { useTimers } from './useTimers'
import { playChime } from './chime'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); localStorage.clear() })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

it('fires the finish effect exactly once at zero-cross', () => {
  const { result } = renderHook(() => useTimers())
  act(() => { result.current.resetCountdown(1000) })
  act(() => { result.current.startCountdown() })
  act(() => { vi.setSystemTime(1500); vi.advanceTimersByTime(500) })
  expect(playChime).toHaveBeenCalledTimes(1)
  act(() => { vi.setSystemTime(2000); vi.advanceTimersByTime(500) })
  expect(playChime).toHaveBeenCalledTimes(1)     // not re-fired
})

it('persists to localStorage', () => {
  const { result } = renderHook(() => useTimers())
  act(() => { result.current.resetCountdown(120000) })
  const saved = JSON.parse(localStorage.getItem('ea-timers') || '{}')
  expect(saved.countdown.remainingMs).toBe(120000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/useTimers.test.ts`
Expected: FAIL — cannot resolve `./useTimers` (and `./chime`).

- [ ] **Step 3: Create `frontend/src/lib/chime.ts` and update `useAlertChime.ts`**

Create `frontend/src/lib/chime.ts`:

```ts
/** Short Web Audio beep, best-effort. No-ops when Web Audio is unavailable or autoplay-blocked. */
export function playChime(): void {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  try {
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    /* autoplay blocked or Web Audio unavailable — chime is best-effort */
  }
}
```

In `frontend/src/lib/useAlertChime.ts`: delete the local `playChime` function (lines 27–44) and add to the imports at the top:

```ts
import { playChime } from '@/lib/chime'
```

Leave `shouldChime` and `useAlertChime` otherwise unchanged (they already call `playChime()`).

- [ ] **Step 4: Create `frontend/src/lib/useTimers.ts`**

```ts
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { playChime } from '@/lib/chime'
import * as T from '@/lib/timers'

const KEY = 'ea-timers'
const DEFAULT_COUNTDOWN: T.CountdownState = { endsAt: null, remainingMs: 300_000, running: false }
const DEFAULT_STOPWATCH: T.StopwatchState = { startedAt: null, accumulatedMs: 0, running: false }

function load(): { countdown: T.CountdownState; stopwatch: T.StopwatchState } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { countdown: p.countdown ?? DEFAULT_COUNTDOWN, stopwatch: p.stopwatch ?? DEFAULT_STOPWATCH }
    }
  } catch { /* fall through to defaults */ }
  return { countdown: DEFAULT_COUNTDOWN, stopwatch: DEFAULT_STOPWATCH }
}

function notifyDone(): void {
  playChime()
  toast.success('Timer done')
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Timer done', { body: 'Your countdown finished.' })
    }
  } catch { /* notification best-effort */ }
}

export function useTimers() {
  // lazy init: read localStorage once at mount, not on every render
  const [countdown, setCountdown] = useState<T.CountdownState>(() => load().countdown)
  const [stopwatch, setStopwatch] = useState<T.StopwatchState>(() => load().stopwatch)
  const [now, setNow] = useState<number>(() => Date.now())
  const fired = useRef(false)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ countdown, stopwatch }))
  }, [countdown, stopwatch])

  useEffect(() => {
    if (!countdown.running && !stopwatch.running) return
    const iv = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(iv)
  }, [countdown.running, stopwatch.running])

  useEffect(() => {
    if (countdown.running && T.remainingMs(countdown, now) <= 0) {
      if (!fired.current) { fired.current = true; notifyDone() }
      setCountdown({ endsAt: null, remainingMs: 0, running: false })
    }
  }, [countdown, now])

  return {
    remaining: T.remainingMs(countdown, now),
    elapsed: T.elapsedMs(stopwatch, now),
    countdownRunning: countdown.running,
    stopwatchRunning: stopwatch.running,
    startCountdown: () => { fired.current = false; setCountdown((s) => T.startCountdown(s, Date.now())) },
    pauseCountdown: () => setCountdown((s) => T.pauseCountdown(s, Date.now())),
    resetCountdown: (ms: number) => { fired.current = false; setCountdown(T.resetCountdown(ms)) },
    startStopwatch: () => setStopwatch((s) => T.startStopwatch(s, Date.now())),
    pauseStopwatch: () => setStopwatch((s) => T.pauseStopwatch(s, Date.now())),
    resetStopwatch: () => setStopwatch(T.resetStopwatch()),
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/useTimers.test.ts src/lib/useAlertChime.test.ts && npx tsc --noEmit`
Expected: PASS (new hook tests + the existing chime tests after the import-only change), no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/chime.ts frontend/src/lib/useAlertChime.ts frontend/src/lib/useTimers.ts frontend/src/lib/useTimers.test.ts
git commit -m "feat(timers): useTimers hook + extract shared playChime to lib/chime"
```

---

### Task 3: Timers section UI + Quickdraw wiring

**Files:**
- Modify: `frontend/src/components/quickdraw/QuickdrawSection.tsx` (add `alwaysShowChildren?` prop)
- Modify: `frontend/src/components/quickdraw/QuickdrawSection.test.tsx` (add case)
- Create: `frontend/src/components/quickdraw/TimersSection.tsx`
- Test: `frontend/src/components/quickdraw/TimersSection.test.tsx`
- Modify: `frontend/src/components/quickdraw/Quickdraw.tsx:52` (render the section)

**Interfaces:**
- Consumes: `useTimers` + `formatClock` (Tasks 1–2); existing `QuickdrawSection`, `useQuickdrawPrefs` (`isCollapsed`, `toggleSection`).
- Produces: `TimersSection({ collapsed, onToggle })` mounted in Quickdraw.

- [ ] **Step 1: Write the failing test**

The default `QuickdrawSection` hides children when `count===0` (shows the empty text). Timers must always show their controls, so first add an `alwaysShowChildren` prop. Add to `frontend/src/components/quickdraw/QuickdrawSection.test.tsx`:

```tsx
it('alwaysShowChildren renders children even when count is 0', () => {
  render(
    <QuickdrawSection id="x" label="X" count={0} collapsed={false} onToggle={() => {}} empty="nothing" alwaysShowChildren>
      <div>controls-here</div>
    </QuickdrawSection>,
  )
  expect(screen.getByText('controls-here')).toBeInTheDocument()
  expect(screen.queryByText('nothing')).not.toBeInTheDocument()
})
```

Create `frontend/src/components/quickdraw/TimersSection.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/chime', () => ({ playChime: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { TimersSection } from './TimersSection'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); localStorage.clear() })
afterEach(() => { vi.useRealTimers() })

it('shows default 05:00 countdown and controls when idle', () => {
  render(<TimersSection collapsed={false} onToggle={() => {}} />)
  expect(screen.getByText('05:00')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /start/i }).length).toBeGreaterThan(0)
})

it('preset chip sets the countdown display', () => {
  render(<TimersSection collapsed={false} onToggle={() => {}} />)
  fireEvent.click(screen.getByLabelText('set 10 minutes'))
  expect(screen.getByText('10:00')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/quickdraw/TimersSection.test.tsx src/components/quickdraw/QuickdrawSection.test.tsx`
Expected: FAIL — cannot resolve `./TimersSection`; `alwaysShowChildren` case fails (prop not implemented).

- [ ] **Step 3: Add the `alwaysShowChildren` prop — `QuickdrawSection.tsx`**

Add `alwaysShowChildren?: boolean` to `QuickdrawSectionProps`, accept it in the destructure, and change the empty-vs-children branch so children win when the flag is set:

```tsx
interface QuickdrawSectionProps {
  id: string
  label: string
  count: number
  collapsed: boolean
  onToggle: (id: string) => void
  loading?: boolean
  error?: boolean
  empty: string
  alwaysShowChildren?: boolean
  children: ReactNode
}

export function QuickdrawSection({ id, label, count, collapsed, onToggle, loading, error, empty, alwaysShowChildren, children }: QuickdrawSectionProps) {
```

In the render branch, replace the `count === 0 ? empty : children` line with:

```tsx
              : (count === 0 && !alwaysShowChildren) ? <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, fontStyle: 'italic' }}>{empty}</Typography>
              : children}
```

- [ ] **Step 4: Create `frontend/src/components/quickdraw/TimersSection.tsx`**

```tsx
import { Box, Typography, Button, Chip } from '@mui/material'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { QuickdrawSection } from './QuickdrawSection'
import { useTimers } from '@/lib/useTimers'
import { formatClock } from '@/lib/timers'

const PRESETS = [5, 10, 25] // minutes
const DEFAULT_MS = 300_000

const clock = { fontFamily: '"JetBrains Mono", monospace', fontSize: 24, lineHeight: 1.2 } as const

export function TimersSection({ collapsed, onToggle }: { collapsed: boolean; onToggle: (id: string) => void }) {
  const t = useTimers()
  const running = (t.countdownRunning ? 1 : 0) + (t.stopwatchRunning ? 1 : 0)
  return (
    <QuickdrawSection id="timers" label="TIMERS" count={running} collapsed={collapsed} onToggle={onToggle} empty="" alwaysShowChildren>
      <Box sx={{ px: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Countdown */}
        <Box>
          <Typography variant="caption" color="text.secondary">Countdown</Typography>
          <Typography sx={clock}>{formatClock(t.remaining)}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, my: 0.5 }}>
            {PRESETS.map((m) => (
              <Chip key={m} size="small" label={`${m}m`} onClick={() => t.resetCountdown(m * 60_000)} aria-label={`set ${m} minutes`} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" startIcon={t.countdownRunning ? <Pause size={14} /> : <Play size={14} />}
              onClick={() => (t.countdownRunning ? t.pauseCountdown() : t.startCountdown())}>
              {t.countdownRunning ? 'Pause' : 'Start'}
            </Button>
            <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => t.resetCountdown(DEFAULT_MS)} aria-label="reset countdown">Reset</Button>
          </Box>
        </Box>
        {/* Stopwatch */}
        <Box>
          <Typography variant="caption" color="text.secondary">Stopwatch</Typography>
          <Typography sx={clock}>{formatClock(t.elapsed)}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Button size="small" startIcon={t.stopwatchRunning ? <Pause size={14} /> : <Play size={14} />}
              onClick={() => (t.stopwatchRunning ? t.pauseStopwatch() : t.startStopwatch())}>
              {t.stopwatchRunning ? 'Pause' : 'Start'}
            </Button>
            <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => t.resetStopwatch()} aria-label="reset stopwatch">Reset</Button>
          </Box>
        </Box>
      </Box>
    </QuickdrawSection>
  )
}
```

- [ ] **Step 5: Wire into `Quickdraw.tsx`**

Add the import near the other section imports (after line 9):

```tsx
import { TimersSection } from './TimersSection'
```

Add the section after `RecentActivitySection` (line 52):

```tsx
        <RecentActivitySection collapsed={isCollapsed('recent')} onToggle={toggleSection} />
        <TimersSection collapsed={isCollapsed('timers')} onToggle={toggleSection} />
```

- [ ] **Step 6: Run tests + typecheck + build**

Run: `cd frontend && npx vitest run src/components/quickdraw && npx tsc --noEmit && npm run build`
Expected: PASS (Timers + QuickdrawSection + existing quickdraw tests), no type errors, build green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/quickdraw/QuickdrawSection.tsx frontend/src/components/quickdraw/QuickdrawSection.test.tsx frontend/src/components/quickdraw/TimersSection.tsx frontend/src/components/quickdraw/TimersSection.test.tsx frontend/src/components/quickdraw/Quickdraw.tsx
git commit -m "feat(timers): Timers Quickdraw section (countdown + stopwatch)"
```

---

## Self-Review

**Spec coverage:**
- Timestamp-anchored state model → Task 1 `timers.ts` (types + pure fns). ✓
- `localStorage['ea-timers']` persistence + 250ms tick + zero-cross once → Task 2 `useTimers`. ✓
- Shared `playChime` extraction → Task 2 `lib/chime.ts` + `useAlertChime` import. ✓
- Finish effect chime + toast + gated Notification → Task 2 `notifyDone`. ✓
- Countdown + stopwatch UI, 5/10/25 presets, Start/Pause/Reset → Task 3 `TimersSection`. ✓
- Quickdraw section (`id="timers"`), no `useQuickdrawPrefs` change → Task 3 wiring. ✓
- `QuickdrawSection` empty-gate conflict (controls must always show) → Task 3 `alwaysShowChildren` prop. ✓
- Tests: pure math, hook once-latch + persistence, UI interaction, existing chime tests still pass → Tasks 1–3. ✓

**Placeholder scan:** none — all code shown. The `useAlertChime.ts` edit references the concrete existing `playChime` (lines 27–44) to delete; not a placeholder.

**Type consistency:** `CountdownState`/`StopwatchState` and every `timers.ts` signature are used identically in `useTimers` (Task 2) and the tests. `useTimers` return shape (`remaining`, `elapsed`, `countdownRunning`, `stopwatchRunning`, `startCountdown`, `pauseCountdown`, `resetCountdown(ms)`, `startStopwatch`, `pauseStopwatch`, `resetStopwatch`) matches `TimersSection`'s usage (Task 3). `playChime` named export consistent across `chime.ts`, `useAlertChime.ts`, `useTimers.ts`, and the test mocks. `localStorage` key `ea-timers` identical in hook and test. `formatClock` used in Task 3 as defined in Task 1.
