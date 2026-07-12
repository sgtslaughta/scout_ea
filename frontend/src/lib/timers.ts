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
