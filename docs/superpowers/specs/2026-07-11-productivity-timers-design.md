# Productivity Timers (SP-B1) — Design

**Date:** 2026-07-11
**Status:** Approved (brainstorm)
**Program:** SP-B Reminders/Alerts — sub-project 1 of 3. Siblings: SP-B3 louder alerting
(COMPLETE + merged), SP-B2 recurring interval alarms (not scoped). This spec covers **B1 only**.

## Goal

A lightweight countdown + stopwatch the user can run while working, living in the existing
Quickdraw drawer. Fully client-side — no backend, no new dependency. Survives in-app
navigation and page reload by anchoring on wall-clock timestamps.

## Scope

- **One countdown** (set a duration → counts down → alarms at zero) and **one stopwatch**
  (counts up). Not a multi-timer list — YAGNI.
- Lives as a new collapsible **Timers** section in the Quickdraw right drawer, following the
  existing `QuickdrawSection` pattern.
- Persists across navigation and reload via `localStorage`.

## Platform reality

A pure-frontend timer cannot run while the browser tab is **closed** (no server clock). "Keeps
running" means: survives route changes and full page reloads by recomputing elapsed/remaining
from stored epoch timestamps against `Date.now()`. The countdown alarm only fires while the tab
is open (foreground or backgrounded). This is stated, not worked around.

## State model

Truth is timestamps, never a decrementing counter (drift-free, reload-safe). A `setInterval`
tick only drives re-render; the displayed value is always derived from `Date.now()`.

```ts
interface CountdownState {
  endsAt: number | null      // epoch ms when it will hit zero (null when paused/idle)
  remainingMs: number        // authoritative when paused; also the last set duration
  running: boolean
}
interface StopwatchState {
  startedAt: number | null   // epoch ms of the current run segment (null when paused)
  accumulatedMs: number      // elapsed banked from previous segments
  running: boolean
}
```

- Countdown remaining = `running ? max(0, endsAt - now) : remainingMs`.
- Stopwatch elapsed = `running ? accumulatedMs + (now - startedAt) : accumulatedMs`.

Both persisted under one `localStorage` key `ea-timers` (`{countdown, stopwatch}` JSON).

## Components / files

### `frontend/src/lib/timers.ts` (pure, tested)

No React. Exports:
- `remainingMs(s: CountdownState, now: number): number`
- `elapsedMs(s: StopwatchState, now: number): number`
- Countdown transitions: `startCountdown(s, now): CountdownState` (arms `endsAt = now + remainingMs`,
  `running=true`), `pauseCountdown(s, now)` (banks `remainingMs = remaining`, `running=false`,
  `endsAt=null`), `resetCountdown(durationMs)` (`{endsAt:null, remainingMs:durationMs, running:false}`).
- Stopwatch transitions: `startStopwatch(s, now)`, `pauseStopwatch(s, now)` (banks accumulated),
  `resetStopwatch()` (`{startedAt:null, accumulatedMs:0, running:false}`).
- `formatMMSS(ms: number): string` → `"MM:SS"` (or `"HH:MM:SS"` past an hour, for the stopwatch).

All take an explicit `now` so they are unit-testable without mocking the clock.

### `frontend/src/lib/chime.ts` (extracted)

Move the existing private `playChime()` out of `useAlertChime.ts` into `lib/chime.ts` and export
it; `useAlertChime.ts` imports it. One shared Web Audio beep, no duplication. Behavior unchanged
(880 Hz, ~150 ms, feature-detected, try/catch no-op).

### `frontend/src/lib/useTimers.ts` (hook, tested via pure core)

Wraps `timers.ts` with React state, a 250 ms interval while either timer runs (cleared when both
idle), and `localStorage` hydration/persistence. Exposes current display values + control
callbacks (`startCountdown`, `pauseCountdown`, `resetCountdown(durationMs)`, and stopwatch
equivalents). Detects the countdown zero-crossing on tick (was `>0`, now `≤0` while `running`) and
invokes the finish effect exactly once, then sets `running=false`.

**Finish effect** (fires once when countdown reaches zero):
1. `playChime()` from `lib/chime.ts`.
2. `toast.success('Timer done')` (sonner, already used app-wide).
3. If `Notification.permission === 'granted'`, `new Notification('Timer done', { body: '...' })`.
   Silently skipped when permission is not granted — never prompt on finish.

### `frontend/src/components/quickdraw/TimersSection.tsx` (tested)

Renders inside the `QuickdrawSection` shell (`id="timers"`, label `TIMERS`, count = number of
running timers). Two compact stacked blocks:
- **Countdown:** `MM:SS` display; quick-set chips 5 / 10 / 25 min (set → `resetCountdown`);
  Start/Pause toggle; Reset.
- **Stopwatch:** `MM:SS`(/`HH:MM:SS`) display; Start/Pause toggle; Reset.

Uses MUI components already in the codebase (`Box`, `Typography`, `Chip`/`Button`,
`IconButton`, lucide icons). Monospace for the time display (matches Quickdraw's existing
`"JetBrains Mono"` numerals).

### `frontend/src/components/quickdraw/Quickdraw.tsx` (wire)

Add `<TimersSection collapsed={isCollapsed('timers')} onToggle={toggleSection} />` alongside the
existing sections. `useQuickdrawPrefs` needs **no change** — section ids are arbitrary strings.

## Data flow

```
useTimers (mounted in TimersSection)
  hydrate from localStorage['ea-timers']
  interval 250ms while running → re-render; values = pure fns vs Date.now()
  countdown tick crosses ≤0 while running → finish effect (chime + toast + Notification) once
  every state change → persist to localStorage
  controls (start/pause/reset) → pure transitions in timers.ts → setState → persist
```

## Error handling

- Corrupt/absent `localStorage['ea-timers']` → fall back to fresh idle timers (try/catch on parse).
- `Date.now()` monotonicity: remaining is clamped `max(0, …)`; a system clock jump backward at
  worst delays the alarm, never negative display.
- Web Audio / Notification unavailable or blocked → the respective effect no-ops (chime already
  guarded; Notification gated on `permission === 'granted'`).
- Interval cleared on unmount and whenever both timers are idle (no idle CPU/render churn).

## Testing

`frontend/src/lib/timers.test.ts` (pure):
- `remainingMs`/`elapsedMs` for running and paused states at explicit `now` values.
- `startCountdown` arms `endsAt = now + remainingMs`; `pauseCountdown` banks the right remainder;
  `resetCountdown(d)` yields idle with `remainingMs=d`.
- Stopwatch start/pause banks `accumulatedMs` correctly across two segments.
- `formatMMSS`: `0`→`00:00`, `65_000`→`01:05`, `3_600_000`→`1:00:00`.

`frontend/src/lib/useTimers.test.ts`:
- Zero-crossing fires the finish callback exactly once (advance a mocked `Date.now` past `endsAt`,
  assert one call; a further tick does not re-fire).
- Persistence round-trip: state written to and hydrated from a mocked `localStorage`.

`frontend/src/components/quickdraw/TimersSection.test.tsx`:
- Quick-set chip sets the countdown display; Start then advancing time updates it; Reset zeroes it.
- Stopwatch Start advances the display; Reset zeroes it.
(Mock `Date.now`; mock `lib/chime` and `Notification` so the finish path doesn't touch real audio.)

`useAlertChime.test.ts` continues to pass after the `playChime` extraction (import path only).

## Out of scope

- Multiple concurrent named timers, pomodoro work/break cycles, per-timer sounds, timer history —
  not in v1.
- Tab-closed / background-server timing — impossible client-only; SP-B2 (interval alarms) is the
  backend-scheduled sibling for anything that must fire without the app open.
- Any backend, table, endpoint, or dependency.
