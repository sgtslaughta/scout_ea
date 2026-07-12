# F2 Timers Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multiple named countdown timers + one stopwatch, with a continuously-repeating alarm, pinned pills at the top of Quickdraw that open a bottom drawer, and a real popout window.

**Architecture:** A multi-timer timestamp core (`lib/timers.ts`) and an alarm loop (`lib/chime.ts`) feed a rewritten `useTimers` hook exposed app-wide via a `TimersProvider` context (one instance per window, synced across windows through localStorage `storage` events). UI is a shared `TimersPanel` rendered inside a bottom `TimersDrawer` (opened by top-pinned `TimerPills`) and inside a bare `TimersPopout` page mounted at `/timers`.

**Tech Stack:** React 19, MUI 9, lucide-react, Vitest + Testing Library, Web Audio.

## Global Constraints

- Frontend only. No backend/API changes.
- Multiple countdown timers; exactly one stopwatch.
- Continuous alarm repeats `playChime` until dismissed when the "Continuous alarm" toggle is on (default **on**); off → single beep.
- Popout is a real new window: `window.open('/timers', 'ea-timers', 'width=420,height=640')`; state syncs via localStorage key `ea-timers` + `storage` events.
- Alarm start/stop MUST be idempotent (StrictMode-safe) and always stop on dismiss/unmount — no stuck or doubled beeping.
- Persisted shape `{ timers, stopwatch, continuousAlarm }`; migrate the old `{ countdown, stopwatch }` shape on load without throwing.
- Frontend cmds: `cd frontend`; tests `npx vitest run <file>`; build `npm run build`.
- One shared `useTimers` instance per window via `TimersProvider`/`useTimersContext` — components never call `useTimers()` directly (would desync localStorage writers).

---

### Task 1: Multi-timer core (`lib/timers.ts`)

**Files:**
- Modify: `frontend/src/lib/timers.ts` (replace `CountdownState` + its fns; keep stopwatch + `formatClock`)
- Test: `frontend/src/lib/timers.test.ts` (extend/replace countdown cases)

**Interfaces:**
- Produces: `Timer { id; label; durationMs; endsAt; remainingMs; running; ringing }`; `makeTimer(label, durationMs)`, `remainingMs(t, now)`, `startTimer(t, now)`, `pauseTimer(t, now)`, `resetTimer(t)`. `StopwatchState` + `elapsedMs`/`startStopwatch`/`pauseStopwatch`/`resetStopwatch` + `formatClock` unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// append to frontend/src/lib/timers.test.ts
import * as T from './timers'

describe('multi-timer core', () => {
  const base: T.Timer = { id: 'a', label: 'X', durationMs: 1000, endsAt: null, remainingMs: 1000, running: false, ringing: false }

  it('makeTimer sets duration and remaining equal, idle', () => {
    const t = T.makeTimer('Tea', 60_000)
    expect(t.label).toBe('Tea')
    expect(t.durationMs).toBe(60_000)
    expect(t.remainingMs).toBe(60_000)
    expect(t.running).toBe(false)
    expect(t.ringing).toBe(false)
    expect(typeof t.id).toBe('string')
  })
  it('startTimer arms endsAt and clears ringing, preserves id/label', () => {
    const s = T.startTimer({ ...base, ringing: true }, 500)
    expect(s.endsAt).toBe(1500)
    expect(s.running).toBe(true)
    expect(s.ringing).toBe(false)
    expect(s.id).toBe('a'); expect(s.label).toBe('X')
  })
  it('remainingMs: running derives from endsAt, paused uses stored', () => {
    expect(T.remainingMs({ ...base, endsAt: 1500, running: true }, 900)).toBe(600)
    expect(T.remainingMs({ ...base, endsAt: 1500, running: true }, 9999)).toBe(0)
    expect(T.remainingMs({ ...base, remainingMs: 777, running: false }, 100)).toBe(777)
  })
  it('pauseTimer banks remaining', () => {
    const p = T.pauseTimer({ ...base, endsAt: 1500, running: true }, 900)
    expect(p.running).toBe(false); expect(p.remainingMs).toBe(600); expect(p.endsAt).toBeNull()
  })
  it('resetTimer restores durationMs and clears running/ringing', () => {
    const r = T.resetTimer({ ...base, remainingMs: 5, running: true, ringing: true, endsAt: 9 })
    expect(r.remainingMs).toBe(1000); expect(r.running).toBe(false); expect(r.ringing).toBe(false); expect(r.endsAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/timers.test.ts`
Expected: FAIL — `makeTimer`/`Timer` not exported; old `CountdownState` cases may also fail.

- [ ] **Step 3: Implement** — replace the countdown block in `frontend/src/lib/timers.ts` (keep the stopwatch section + `formatClock` exactly as they are):

```ts
export interface Timer {
  id: string
  label: string
  durationMs: number      // configured length; reset restores to this
  endsAt: number | null   // epoch ms it reaches zero; null when paused/idle/ringing
  remainingMs: number     // authoritative when paused
  running: boolean
  ringing: boolean        // reached zero, alarm active until dismissed
}

let _seq = 0
function newId(): string {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID() } catch { /* fall through */ }
  return `t_${_seq++}_${Date.now()}`
}

export function makeTimer(label: string, durationMs: number): Timer {
  return { id: newId(), label, durationMs, endsAt: null, remainingMs: durationMs, running: false, ringing: false }
}
export function remainingMs(t: Timer, now: number): number {
  return t.running && t.endsAt !== null ? Math.max(0, t.endsAt - now) : t.remainingMs
}
export function startTimer(t: Timer, now: number): Timer {
  if (t.running || t.remainingMs <= 0) return t
  return { ...t, endsAt: now + t.remainingMs, running: true, ringing: false }
}
export function pauseTimer(t: Timer, now: number): Timer {
  if (!t.running) return t
  return { ...t, endsAt: null, remainingMs: remainingMs(t, now), running: false }
}
export function resetTimer(t: Timer): Timer {
  return { ...t, endsAt: null, remainingMs: t.durationMs, running: false, ringing: false }
}
```

Delete the old `CountdownState` interface and `remainingMs(CountdownState,…)`/`startCountdown`/`pauseCountdown`/`resetCountdown`. Keep `StopwatchState`, `elapsedMs`, `startStopwatch`, `pauseStopwatch`, `resetStopwatch`, `formatClock` unchanged. Remove any now-obsolete `CountdownState` cases from the existing test file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/timers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/timers.ts frontend/src/lib/timers.test.ts
git commit -m "feat(timers): multi-timer core model (Timer + per-timer pure fns)"
```

---

### Task 2: Alarm loop (`lib/chime.ts`)

**Files:**
- Modify: `frontend/src/lib/chime.ts` (add loop; keep `playChime`)
- Test: `frontend/src/lib/chime.test.ts` (create)

**Interfaces:**
- Produces: `startAlarm(intervalMs = 2000, beep = playChime)`, `stopAlarm()`, `isAlarmRunning()`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/chime.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { startAlarm, stopAlarm, isAlarmRunning } from './chime'

afterEach(() => { stopAlarm(); vi.useRealTimers() })

describe('alarm loop', () => {
  it('plays immediately then on the interval', () => {
    vi.useFakeTimers()
    const beep = vi.fn()
    startAlarm(2000, beep)
    expect(beep).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000); expect(beep).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(2000); expect(beep).toHaveBeenCalledTimes(3)
  })
  it('is idempotent — a second start does not double the loop', () => {
    vi.useFakeTimers()
    const beep = vi.fn()
    startAlarm(2000, beep)
    startAlarm(2000, beep)      // ignored while running
    expect(beep).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000); expect(beep).toHaveBeenCalledTimes(2)
  })
  it('stopAlarm halts the loop', () => {
    vi.useFakeTimers()
    const beep = vi.fn()
    startAlarm(2000, beep)
    stopAlarm()
    expect(isAlarmRunning()).toBe(false)
    vi.advanceTimersByTime(4000); expect(beep).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/chime.test.ts`
Expected: FAIL — `startAlarm` not exported.

- [ ] **Step 3: Implement** — append to `frontend/src/lib/chime.ts` (leave `playChime` as-is):

```ts
let alarmHandle: ReturnType<typeof setInterval> | null = null

/** Repeat a beep every intervalMs until stopAlarm(). Idempotent while running. */
export function startAlarm(intervalMs = 2000, beep: () => void = playChime): void {
  if (alarmHandle !== null) return
  beep()
  alarmHandle = setInterval(beep, intervalMs)
}
export function stopAlarm(): void {
  if (alarmHandle !== null) { clearInterval(alarmHandle); alarmHandle = null }
}
export function isAlarmRunning(): boolean {
  return alarmHandle !== null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/chime.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/chime.ts frontend/src/lib/chime.test.ts
git commit -m "feat(timers): repeating alarm loop (startAlarm/stopAlarm)"
```

---

### Task 3: Hook rewrite + context (`lib/useTimers.tsx`)

**Files:**
- Replace: `frontend/src/lib/useTimers.ts` → **rename to** `frontend/src/lib/useTimers.tsx` (now returns JSX for the Provider)
- Test: `frontend/src/lib/useTimers.test.ts` → replace contents (rename to `.tsx` if it needs JSX; here it does not)

**Interfaces:**
- Consumes: `T.Timer`, `T.makeTimer`, `T.startTimer`, `T.pauseTimer`, `T.resetTimer`, `T.remainingMs`, `T.elapsedMs`, `T.StopwatchState`, stopwatch fns (Task 1); `playChime`, `startAlarm`, `stopAlarm` (Task 2).
- Produces: `TimersProvider` (React component) and `useTimersContext()` returning:
  ```ts
  {
    timers: { id: string; label: string; remaining: number; running: boolean; ringing: boolean }[]
    stopwatch: { elapsed: number; running: boolean }
    continuousAlarm: boolean
    setContinuousAlarm(v: boolean): void
    addTimer(label: string, ms: number): void
    removeTimer(id: string): void
    startTimer(id: string): void
    pauseTimer(id: string): void
    resetTimer(id: string): void
    dismissAlarm(id: string): void
    startStopwatch(): void; pauseStopwatch(): void; resetStopwatch(): void
  }
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/lib/useTimers.test.tsx  (delete the old useTimers.test.ts)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { TimersProvider, useTimersContext } from './useTimers'

vi.mock('@/lib/chime', () => ({ playChime: vi.fn(), startAlarm: vi.fn(), stopAlarm: vi.fn() }))
import { startAlarm } from '@/lib/chime'

const wrapper = ({ children }: { children: ReactNode }) => <TimersProvider>{children}</TimersProvider>

beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers() })

describe('useTimers', () => {
  it('adds and removes timers', () => {
    const { result } = renderHook(() => useTimersContext(), { wrapper })
    act(() => result.current.addTimer('Tea', 1000))
    expect(result.current.timers).toHaveLength(1)
    const id = result.current.timers[0].id
    act(() => result.current.removeTimer(id))
    expect(result.current.timers).toHaveLength(0)
  })

  it('rings and triggers the continuous alarm at zero-cross', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { result } = renderHook(() => useTimersContext(), { wrapper })
    act(() => result.current.addTimer('T', 1000))
    const id = result.current.timers[0].id
    act(() => result.current.startTimer(id))
    act(() => { vi.setSystemTime(1500); vi.advanceTimersByTime(500) })
    expect(result.current.timers[0].ringing).toBe(true)
    expect(startAlarm).toHaveBeenCalled()
    act(() => result.current.dismissAlarm(id))
    expect(result.current.timers[0].ringing).toBe(false)
  })

  it('migrates the old { countdown } localStorage shape', () => {
    localStorage.setItem('ea-timers', JSON.stringify({ countdown: { endsAt: null, remainingMs: 120000, running: false }, stopwatch: { startedAt: null, accumulatedMs: 0, running: false } }))
    const { result } = renderHook(() => useTimersContext(), { wrapper })
    expect(result.current.timers).toHaveLength(1)
    expect(result.current.timers[0].label).toBe('Timer')
    expect(result.current.timers[0].remaining).toBe(120000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/useTimers.test.tsx`
Expected: FAIL — `TimersProvider`/`useTimersContext` not exported.

- [ ] **Step 3: Implement** — create `frontend/src/lib/useTimers.tsx` (delete the old `useTimers.ts`):

```tsx
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { playChime, startAlarm, stopAlarm } from '@/lib/chime'
import * as T from '@/lib/timers'

const KEY = 'ea-timers'
const DEFAULT_STOPWATCH: T.StopwatchState = { startedAt: null, accumulatedMs: 0, running: false }

interface Persisted { timers: T.Timer[]; stopwatch: T.StopwatchState; continuousAlarm: boolean }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (Array.isArray(p.timers)) {
        return { timers: p.timers, stopwatch: p.stopwatch ?? DEFAULT_STOPWATCH, continuousAlarm: p.continuousAlarm ?? true }
      }
      if (p.countdown) { // migrate old single-countdown shape
        const c = p.countdown
        const t: T.Timer = { id: 'migrated', label: 'Timer', durationMs: c.remainingMs ?? 300_000, endsAt: c.endsAt ?? null, remainingMs: c.remainingMs ?? 300_000, running: c.running ?? false, ringing: false }
        return { timers: [t], stopwatch: p.stopwatch ?? DEFAULT_STOPWATCH, continuousAlarm: true }
      }
    }
  } catch { /* fall through to defaults */ }
  return { timers: [], stopwatch: DEFAULT_STOPWATCH, continuousAlarm: true }
}

function useTimersState() {
  const init = load()
  const [timers, setTimers] = useState<T.Timer[]>(init.timers)
  const [stopwatch, setStopwatch] = useState<T.StopwatchState>(init.stopwatch)
  const [continuousAlarm, setContinuousAlarm] = useState<boolean>(init.continuousAlarm)
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ timers, stopwatch, continuousAlarm }))
  }, [timers, stopwatch, continuousAlarm])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return
      const p = load(); setTimers(p.timers); setStopwatch(p.stopwatch); setContinuousAlarm(p.continuousAlarm)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const anyRunning = timers.some((t) => t.running) || stopwatch.running
    if (!anyRunning) return
    const iv = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(iv)
  }, [timers, stopwatch.running])

  useEffect(() => {
    let changed = false
    const next = timers.map((t) => {
      if (t.running && T.remainingMs(t, now) <= 0) { changed = true; return { ...t, running: false, endsAt: null, remainingMs: 0, ringing: true } }
      return t
    })
    if (changed) {
      setTimers(next)
      if (!continuousAlarm) { playChime(); toast.success('Timer done') }
    }
  }, [timers, now, continuousAlarm])

  const anyRinging = timers.some((t) => t.ringing)
  useEffect(() => {
    if (anyRinging && continuousAlarm) startAlarm(); else stopAlarm()
    return () => stopAlarm()
  }, [anyRinging, continuousAlarm])

  return {
    timers: timers.map((t) => ({ id: t.id, label: t.label, remaining: T.remainingMs(t, now), running: t.running, ringing: t.ringing })),
    stopwatch: { elapsed: T.elapsedMs(stopwatch, now), running: stopwatch.running },
    continuousAlarm,
    setContinuousAlarm,
    addTimer: (label: string, ms: number) => setTimers((ts) => [...ts, T.makeTimer(label || 'Timer', ms)]),
    removeTimer: (id: string) => setTimers((ts) => ts.filter((t) => t.id !== id)),
    startTimer: (id: string) => setTimers((ts) => ts.map((t) => (t.id === id ? T.startTimer(t, Date.now()) : t))),
    pauseTimer: (id: string) => setTimers((ts) => ts.map((t) => (t.id === id ? T.pauseTimer(t, Date.now()) : t))),
    resetTimer: (id: string) => setTimers((ts) => ts.map((t) => (t.id === id ? T.resetTimer(t) : t))),
    dismissAlarm: (id: string) => setTimers((ts) => ts.map((t) => (t.id === id ? { ...t, ringing: false } : t))),
    startStopwatch: () => setStopwatch((s) => T.startStopwatch(s, Date.now())),
    pauseStopwatch: () => setStopwatch((s) => T.pauseStopwatch(s, Date.now())),
    resetStopwatch: () => setStopwatch(T.resetStopwatch()),
  }
}

type TimersApi = ReturnType<typeof useTimersState>
const Ctx = createContext<TimersApi | null>(null)

export function TimersProvider({ children }: { children: ReactNode }) {
  const api = useTimersState()
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
export function useTimersContext(): TimersApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTimersContext must be used within TimersProvider')
  return v
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/useTimers.test.tsx`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/useTimers.tsx frontend/src/lib/useTimers.test.tsx
git rm frontend/src/lib/useTimers.ts frontend/src/lib/useTimers.test.ts 2>/dev/null || true
git commit -m "feat(timers): multi-timer hook + TimersProvider context (persist, migrate, sync, alarm)"
```

---

### Task 4: Shared controls — `TimersPanel`

**Files:**
- Create: `frontend/src/components/quickdraw/TimersPanel.tsx`
- Test: `frontend/src/components/quickdraw/TimersPanel.test.tsx`

**Interfaces:**
- Consumes: `useTimersContext` (Task 3); `formatClock` (`@/lib/timers`).
- Produces: `TimersPanel({ showPopout = true })`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/quickdraw/TimersPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimersProvider } from '@/lib/useTimers'
import { TimersPanel } from './TimersPanel'

const wrap = (node: React.ReactNode) => render(<TimersProvider>{node}</TimersProvider>)
beforeEach(() => localStorage.clear())

describe('TimersPanel', () => {
  it('adds a timer via a preset chip', () => {
    wrap(<TimersPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'set 5 minutes' }))
    expect(screen.getByText('05:00')).toBeInTheDocument()
  })
  it('adds a timer with a custom minutes value', () => {
    wrap(<TimersPanel />)
    fireEvent.change(screen.getByLabelText('custom minutes'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'add timer' }))
    expect(screen.getByText('03:00')).toBeInTheDocument()
  })
  it('toggles the continuous alarm setting', () => {
    wrap(<TimersPanel />)
    const toggle = screen.getByRole('checkbox', { name: /continuous alarm/i })
    expect(toggle).toBeChecked()          // default on
    fireEvent.click(toggle)
    expect(toggle).not.toBeChecked()
  })
  it('popout button opens a new window', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrap(<TimersPanel />)
    fireEvent.click(screen.getByRole('button', { name: /popout/i }))
    expect(open).toHaveBeenCalledWith('/timers', 'ea-timers', expect.stringContaining('width'))
  })
  it('hides the popout button when showPopout is false', () => {
    wrap(<TimersPanel showPopout={false} />)
    expect(screen.queryByRole('button', { name: /popout/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/quickdraw/TimersPanel.test.tsx`
Expected: FAIL — cannot resolve `./TimersPanel`.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/quickdraw/TimersPanel.tsx
import { useState } from 'react'
import { Box, Typography, Button, Chip, IconButton, TextField, Switch, FormControlLabel, Tooltip } from '@mui/material'
import { Play, Pause, RotateCcw, X, BellOff, Plus, ExternalLink } from 'lucide-react'
import { useTimersContext } from '@/lib/useTimers'
import { formatClock } from '@/lib/timers'

const PRESETS = [1, 5, 10, 15, 25, 45, 60] // minutes
const clock = { fontFamily: '"JetBrains Mono", monospace', fontSize: 22, lineHeight: 1.2 } as const

export function TimersPanel({ showPopout = true }: { showPopout?: boolean }) {
  const t = useTimersContext()
  const [label, setLabel] = useState('')
  const [mins, setMins] = useState('')

  const addCustom = () => {
    const m = parseFloat(mins)
    if (!Number.isFinite(m) || m <= 0) return
    t.addTimer(label.trim(), Math.round(m * 60_000))
    setLabel(''); setMins('')
  }

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 260 }}>
      {/* Add row */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {PRESETS.map((m) => (
            <Chip key={m} size="small" label={`${m}m`} onClick={() => t.addTimer(label.trim(), m * 60_000)} aria-label={`set ${m} minutes`} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" label="Name" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ flex: 1 }} />
          <TextField size="small" label="Min" value={mins} onChange={(e) => setMins(e.target.value)}
            inputProps={{ 'aria-label': 'custom minutes', inputMode: 'numeric' }} sx={{ width: 72 }} />
          <Button size="small" variant="outlined" startIcon={<Plus size={14} />} onClick={addCustom} aria-label="add timer">Add</Button>
        </Box>
      </Box>

      {/* Timers */}
      {t.timers.map((tm) => (
        <Box key={tm.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: tm.ringing ? 'error.main' : 'action.hover' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap>{tm.label}</Typography>
            <Typography sx={{ ...clock, color: tm.ringing ? 'error.contrastText' : 'text.primary' }}>{formatClock(tm.remaining)}</Typography>
          </Box>
          {tm.ringing ? (
            <Button size="small" color="inherit" startIcon={<BellOff size={14} />} onClick={() => t.dismissAlarm(tm.id)}>Dismiss</Button>
          ) : (
            <>
              <Tooltip title={tm.running ? 'Pause' : 'Start'}><IconButton size="small" aria-label={tm.running ? `pause ${tm.label}` : `start ${tm.label}`} onClick={() => (tm.running ? t.pauseTimer(tm.id) : t.startTimer(tm.id))}>{tm.running ? <Pause size={16} /> : <Play size={16} />}</IconButton></Tooltip>
              <Tooltip title="Reset"><IconButton size="small" aria-label={`reset ${tm.label}`} onClick={() => t.resetTimer(tm.id)}><RotateCcw size={16} /></IconButton></Tooltip>
            </>
          )}
          <Tooltip title="Remove"><IconButton size="small" aria-label={`remove ${tm.label}`} onClick={() => t.removeTimer(tm.id)}><X size={16} /></IconButton></Tooltip>
        </Box>
      ))}

      {/* Stopwatch */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Stopwatch</Typography>
          <Typography sx={clock}>{formatClock(t.stopwatch.elapsed)}</Typography>
        </Box>
        <IconButton size="small" aria-label={t.stopwatch.running ? 'pause stopwatch' : 'start stopwatch'} onClick={() => (t.stopwatch.running ? t.pauseStopwatch() : t.startStopwatch())}>{t.stopwatch.running ? <Pause size={16} /> : <Play size={16} />}</IconButton>
        <IconButton size="small" aria-label="reset stopwatch" onClick={() => t.resetStopwatch()}><RotateCcw size={16} /></IconButton>
      </Box>

      {/* Settings + popout */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <FormControlLabel
          control={<Switch size="small" checked={t.continuousAlarm} onChange={(e) => t.setContinuousAlarm(e.target.checked)} />}
          label={<Typography variant="caption">Continuous alarm</Typography>}
        />
        {showPopout && (
          <Button size="small" startIcon={<ExternalLink size={14} />} onClick={() => window.open('/timers', 'ea-timers', 'width=420,height=640')}>Popout</Button>
        )}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/quickdraw/TimersPanel.test.tsx`
Expected: PASS (5).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quickdraw/TimersPanel.tsx frontend/src/components/quickdraw/TimersPanel.test.tsx
git commit -m "feat(timers): shared TimersPanel controls (add/custom/presets/stopwatch/alarm/popout)"
```

---

### Task 5: Pills + bottom drawer + Quickdraw wiring

**Files:**
- Create: `frontend/src/components/quickdraw/TimerPills.tsx`
- Create: `frontend/src/components/quickdraw/TimersDrawer.tsx`
- Modify: `frontend/src/components/quickdraw/Quickdraw.tsx`
- Delete: `frontend/src/components/quickdraw/TimersSection.tsx` (+ `TimersSection.test.tsx`)
- Test: `frontend/src/components/quickdraw/TimerPills.test.tsx`

**Interfaces:**
- Consumes: `useTimersContext` (Task 3); `formatClock`; `TimersPanel` (Task 4).
- Produces: `TimerPills({ onOpen })`, `TimersDrawer({ open, onClose })`.

- [ ] **Step 1: Confirm the stub-section consumers**

Run: `cd frontend && grep -rn "TimersSection" src`
Expected: only `Quickdraw.tsx` imports it (+ its own test). If anything else, adapt.

- [ ] **Step 2: Write the failing test**

```tsx
// frontend/src/components/quickdraw/TimerPills.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TimersProvider, useTimersContext } from '@/lib/useTimers'
import { TimerPills } from './TimerPills'

beforeEach(() => localStorage.clear())

function Seed() { // helper to add a timer from within the provider
  const t = useTimersContext()
  return <button onClick={() => t.addTimer('Focus', 60_000)}>seed</button>
}

describe('TimerPills', () => {
  it('shows an open button and calls onOpen', () => {
    const onOpen = vi.fn()
    render(<TimersProvider><TimerPills onOpen={onOpen} /></TimersProvider>)
    fireEvent.click(screen.getByRole('button', { name: /timers/i }))
    expect(onOpen).toHaveBeenCalled()
  })
  it('renders a pill for each timer', () => {
    render(<TimersProvider><Seed /><TimerPills onOpen={() => {}} /></TimersProvider>)
    act(() => { fireEvent.click(screen.getByText('seed')) })
    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/quickdraw/TimerPills.test.tsx`
Expected: FAIL — cannot resolve `./TimerPills`.

- [ ] **Step 4: Implement the two components**

```tsx
// frontend/src/components/quickdraw/TimerPills.tsx
import { Box, Chip, IconButton, Tooltip } from '@mui/material'
import { Timer as TimerIcon, Play, Pause } from 'lucide-react'
import { useTimersContext } from '@/lib/useTimers'
import { formatClock } from '@/lib/timers'

export function TimerPills({ onOpen }: { onOpen: () => void }) {
  const t = useTimersContext()
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}>
      <Tooltip title="Open timers"><IconButton size="small" aria-label="Timers" onClick={onOpen}><TimerIcon size={16} /></IconButton></Tooltip>
      {t.timers.map((tm) => (
        <Chip
          key={tm.id} size="small"
          color={tm.ringing ? 'error' : 'default'}
          variant={tm.ringing ? 'filled' : 'outlined'}
          onClick={() => (tm.ringing ? t.dismissAlarm(tm.id) : tm.running ? t.pauseTimer(tm.id) : t.startTimer(tm.id))}
          icon={tm.running ? <Pause size={12} /> : <Play size={12} />}
          label={`${tm.label} ${formatClock(tm.remaining)}`}
          aria-label={`${tm.label} ${tm.ringing ? 'dismiss' : tm.running ? 'pause' : 'start'}`}
        />
      ))}
    </Box>
  )
}
```

```tsx
// frontend/src/components/quickdraw/TimersDrawer.tsx
import Drawer from '@mui/material/Drawer'
import { TimersPanel } from './TimersPanel'

export function TimersDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <TimersPanel />
    </Drawer>
  )
}
```

- [ ] **Step 5: Wire into `Quickdraw.tsx`** — add pills at the top and the drawer; drop `TimersSection`.

Add imports:
```tsx
import { useState } from 'react'
import { TimerPills } from './TimerPills'
import { TimersDrawer } from './TimersDrawer'
```
Remove `import { TimersSection } from './TimersSection'`. Add drawer state inside the component: `const [timersOpen, setTimersOpen] = useState(false)`. Render `<TimerPills onOpen={() => setTimersOpen(true)} />` immediately inside the drawer's scroll container **before** `<NeedsResponseSection …>`, remove the `<TimersSection … />` line, and add `<TimersDrawer open={timersOpen} onClose={() => setTimersOpen(false)} />` at the end of the Quickdraw root Box. (Match the existing structure seen in the file; the pills bar sits at the top of the sections list, the drawer is a sibling overlay.)

- [ ] **Step 6: Delete the old section**

```bash
cd frontend && git rm src/components/quickdraw/TimersSection.tsx src/components/quickdraw/TimersSection.test.tsx
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/quickdraw/TimerPills.test.tsx src/components/quickdraw/Quickdraw.test.tsx`
Expected: PASS (if a `Quickdraw.test.tsx` exists it must not reference TimersSection; update it if it does).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/quickdraw/TimerPills.tsx frontend/src/components/quickdraw/TimersDrawer.tsx frontend/src/components/quickdraw/TimerPills.test.tsx frontend/src/components/quickdraw/Quickdraw.tsx
git commit -m "feat(timers): top pills + bottom drawer in Quickdraw; remove old TimersSection"
```

---

### Task 6: Popout window + provider mount

**Files:**
- Create: `frontend/src/components/quickdraw/TimersPopout.tsx`
- Modify: `frontend/src/main.tsx` (branch on `/timers`; wrap in `TimersProvider`)
- Test: `frontend/src/components/quickdraw/TimersPopout.test.tsx`

**Interfaces:**
- Consumes: `TimersPanel` (Task 4), `TimersProvider` (Task 3).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/quickdraw/TimersPopout.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimersProvider } from '@/lib/useTimers'
import { TimersPopout } from './TimersPopout'

beforeEach(() => localStorage.clear())

describe('TimersPopout', () => {
  it('renders the timers panel without a popout button (already in popout)', () => {
    render(<TimersProvider><TimersPopout /></TimersProvider>)
    expect(screen.getByText('Timers')).toBeInTheDocument()               // heading
    expect(screen.queryByRole('button', { name: /popout/i })).toBeNull() // showPopout=false
    expect(screen.getByRole('button', { name: 'add timer' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/quickdraw/TimersPopout.test.tsx`
Expected: FAIL — cannot resolve `./TimersPopout`.

- [ ] **Step 3: Implement the popout page**

```tsx
// frontend/src/components/quickdraw/TimersPopout.tsx
import { Box, Typography } from '@mui/material'
import { TimersPanel } from './TimersPanel'

export function TimersPopout() {
  return (
    <Box sx={{ p: 2, minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Timers</Typography>
      <TimersPanel showPopout={false} />
    </Box>
  )
}
```

- [ ] **Step 4: Mount provider + branch in `main.tsx`**

Wrap the render so both the app and the popout share a `TimersProvider`, and branch on the path. Edit `frontend/src/main.tsx`:

Add imports:
```tsx
import { TimersProvider } from './lib/useTimers'
import { TimersPopout } from './components/quickdraw/TimersPopout'
```

Replace the `<BrowserRouter><App /></BrowserRouter>` block with:
```tsx
<BrowserRouter>
  <TimersProvider>
    {window.location.pathname === '/timers' ? <TimersPopout /> : <App />}
  </TimersProvider>
</BrowserRouter>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/quickdraw/TimersPopout.test.tsx`
Expected: PASS.

- [ ] **Step 6: Full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all green; build succeeds (confirms `main.tsx` branch + no dangling `useTimers.ts`/`TimersSection` imports).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/quickdraw/TimersPopout.tsx frontend/src/components/quickdraw/TimersPopout.test.tsx frontend/src/main.tsx
git commit -m "feat(timers): /timers popout window + shared TimersProvider mount"
```

---

## Self-Review

- **Spec coverage:** multi-timer core (Task 1 ✓); continuous alarm loop (Task 2 ✓); hook rewrite with persistence/migration/storage-sync/ringing + provider (Task 3 ✓); TimersPanel add/custom/presets/stopwatch/alarm-toggle/popout (Task 4 ✓); top pills + bottom drawer + Quickdraw wiring + old-section removal (Task 5 ✓); real `/timers` popout window + provider mount (Task 6 ✓); one stopwatch, frontend-only, idempotent alarm (Global Constraints ✓).
- **Placeholder scan:** none — full code/commands throughout. Task 5 Step 5 references the existing Quickdraw structure (implementer confirms the exact insertion points from the file); every other edit is literal.
- **Type consistency:** `Timer` fields (incl. `durationMs`, `ringing`) defined in Task 1, consumed by the hook (Task 3); the hook's public API (display `timers` projection, `addTimer(label, ms)`, `resetTimer(id)` with no ms, `dismissAlarm`, `continuousAlarm`/`setContinuousAlarm`) is used verbatim by Tasks 4–6; `TimersProvider`/`useTimersContext` names consistent; `startAlarm`/`stopAlarm` signatures match between Task 2 and Task 3's mock.
- **Watch-item:** the completion + alarm effects call `setTimers`/`startAlarm` inside `useEffect` (the repo already accepts this react-hooks pattern elsewhere); the alarm effect's cleanup `stopAlarm()` plus idempotent start prevents stuck/doubled beeps under StrictMode. (`// ponytail: alarm is a module singleton; fine for one tab, storage-synced across tabs`.)
