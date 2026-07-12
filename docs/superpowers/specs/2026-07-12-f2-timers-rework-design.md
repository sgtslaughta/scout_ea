# F2 — Timers Rework — Design

**Date:** 2026-07-12
**Status:** Approved (design), pending plan
**Type:** Single feature, ~6 implementation tasks (frontend only)
**Scope:** Frontend only.

## Problem

Timers are a single countdown + single stopwatch buried as the last Quickdraw section. Users want: multiple concurrent named timers, custom durations, a continuously-repeating alarm (current beep fires once), timers pinned to the top of Quickdraw opening a bottom drawer of controls, and a popout into a large dedicated window.

## Decisions (locked)

- **Multiple named countdown timers** + **one stopwatch** (stopwatch stays single).
- **Continuous alarm:** a finished timer repeats the chime until dismissed, when the "Continuous alarm" toggle is on (default on); off → single beep (current behavior).
- **Popout = a real new browser window** at `/timers`, state-synced via localStorage + `storage` events (the timestamp core keeps both windows consistent).
- **Top pills → bottom drawer:** compact timer pills pinned at the top of Quickdraw; a button opens a MUI bottom `Drawer` with full controls.

## Architecture

### Core — `lib/timers.ts`

Replace the single `CountdownState` with a multi-timer model:

```ts
export interface Timer {
  id: string
  label: string
  endsAt: number | null   // epoch ms it reaches zero; null when paused/idle/ringing
  remainingMs: number     // authoritative when paused; the last-set duration
  running: boolean
  ringing: boolean        // reached zero, alarm active until dismissed
}
```

- `makeTimer(label: string, durationMs: number): Timer` — new idle timer (`id = crypto.randomUUID()`).
- Per-timer pure fns mirroring today, preserving `id`/`label`/`ringing`: `remainingMs(t, now)`, `startTimer(t, now)`, `pauseTimer(t, now)`, `resetTimer(t, durationMs)` (clears `ringing`).
- Keep `StopwatchState` + its fns and `formatClock` unchanged.

### Alarm — `lib/chime.ts`

Keep `playChime()`. Add a module-singleton loop:

```ts
export function startAlarm(intervalMs = 2000): void  // plays immediately, then every intervalMs; idempotent
export function stopAlarm(): void                    // clears the loop
```

### Hook — `lib/useTimers.ts` (rewrite)

State: `timers: Timer[]`, `stopwatch`, `continuousAlarm: boolean`, `now`.

- **Persistence** to localStorage `ea-timers` as `{ timers, stopwatch, continuousAlarm }`. **Migration:** an old `{ countdown, stopwatch }` payload converts `countdown` into a single `Timer` (label "Timer").
- **Tick:** 250ms interval while any timer or the stopwatch is running.
- **Completion:** when a running timer's remaining ≤ 0 → set `ringing:true, running:false, endsAt:null`. On entering ringing: if `continuousAlarm` → `startAlarm()`, else `playChime()` + toast once.
- **Alarm lifecycle:** an effect keyed on "any ringing" + `continuousAlarm` ensures the loop runs while something rings and `stopAlarm()`s when nothing does; cleanup on unmount.
- **Cross-window sync:** `window.addEventListener('storage', …)` on key `ea-timers` rehydrates `timers/stopwatch/continuousAlarm`.

API:

```ts
timers: { id; label; remaining; running; ringing }[]     // now-projected for display
stopwatch: { elapsed; running }
continuousAlarm: boolean; setContinuousAlarm(v: boolean): void
addTimer(label: string, ms: number): void
removeTimer(id: string): void
startTimer(id): void; pauseTimer(id): void; resetTimer(id, ms): void
dismissAlarm(id): void        // clears ringing; stops loop if none left ringing
startStopwatch(): void; pauseStopwatch(): void; resetStopwatch(): void
```

### UI

- **`TimersPanel`** (new, shared) — the full control surface: list of timers (label + live clock + start/pause/reset/remove + Dismiss when ringing), an "add timer" row (name + preset chips `1/5/10/15/25/45/60m` + custom-minutes input), the stopwatch, the "Continuous alarm" toggle, and a **Popout** button (`window.open('/timers', 'ea-timers', 'width=420,height=640')`).
- **`TimerPills`** (new) — compact bar pinned at the **top of Quickdraw** (above the sections): one pill per timer (label + live time + start/pause; ringing pills flash with a Dismiss). A button opens the drawer. Empty → a single "Timers" open button.
- **`TimersDrawer`** (new) — MUI `Drawer anchor="bottom"` hosting `TimersPanel`.
- **`Quickdraw.tsx`** — render `<TimerPills onOpen={…}/>` at the top and `<TimersDrawer open={…}/>`; drop the old inline `TimersSection`.
- Delete `components/quickdraw/TimersSection.tsx` (+ its test).

### Popout — `TimersPopout` + `main.tsx`

- **`TimersPopout`** (new) — full-page wrapper rendering `TimersPanel` (no sidebar/shell).
- **`main.tsx`** — before rendering `<App/>`, branch: `window.location.pathname === '/timers'` → render `<TimersPopout/>` inside the existing providers instead of `<App/>`.

## Data flow

```
useTimers (main window) ── localStorage 'ea-timers' ──> useTimers (popout window)
        ▲            └─ storage event rehydrates each side ─┘
        │ timestamp core → both windows compute the same remaining
  TimerPills / TimersDrawer(TimersPanel)      TimersPopout(TimersPanel)
        │ addTimer/start/pause/reset/dismiss (writes localStorage)
  completion → ringing → startAlarm()/playChime(); dismissAlarm → stopAlarm()
```

## Error / edge handling

- **Stuck alarm:** `dismissAlarm` and the ringing-effect cleanup (and unmount) must `stopAlarm()`; guard so an unmounted popout doesn't leave the loop running.
- **StrictMode double-invoke:** alarm start/stop must be idempotent (singleton guard) so dev double-mount doesn't double-beep.
- **Old localStorage shape:** migrated on load; never throws.
- **Autoplay-blocked audio:** `playChime` already best-effort no-ops.
- **`crypto.randomUUID` absent:** fall back to `` `t_${Date.now()}_${count}` `` (monotonic counter) so ids stay unique.

## Testing

- **Core:** `makeTimer` shape; `startTimer`/`pauseTimer` preserve id/label/ringing; `resetTimer` clears ringing; `remainingMs` running-vs-paused.
- **Alarm:** `startAlarm` plays immediately + schedules (fake timers, spy `playChime`); idempotent; `stopAlarm` clears.
- **Hook:** add/remove timers; a timer crossing zero sets ringing + triggers alarm (continuous → loop, else once); `dismissAlarm` stops the loop; old-shape migration; `storage` event rehydrates.
- **UI:** `TimerPills` shows a running timer + opens the drawer; `TimersPanel` custom-minutes input adds a timer; preset chip adds a timer; toggle flips continuousAlarm; Popout button calls `window.open`.
- **Popout:** `main.tsx` renders `TimersPopout` (bare) at `/timers` — assert via a `TimersPopout` render test (no sidebar role present).
- **Regression:** full FE suite + `npm run build`.

## Success criteria

- Multiple named timers run concurrently; each independently start/pause/reset/remove.
- Custom durations via a minutes input; preset chips still work.
- Finished timer repeats the alarm until dismissed when the toggle is on; single beep when off.
- Timer pills pinned at top of Quickdraw; a button opens the bottom drawer of full controls.
- Popout opens `/timers` in a new window showing the same timers, synced via localStorage.
- Old single-timer persisted state migrates without error.
- No stuck/duplicate beeping; all tests + build green; no backend diff.

## Non-goals

- Multiple stopwatches (one only).
- Per-timer custom sounds; server-side timers; notifications rework (keep existing best-effort Notification).
- Live cross-window control is best-effort via storage events; timestamp math guarantees eventual consistency (no shared-worker channel).
