export interface Timer {
  id: string
  label: string
  durationMs: number      // configured length; reset restores to this
  endsAt: number | null   // epoch ms it reaches zero; null when paused/idle/ringing
  remainingMs: number     // authoritative when paused
  running: boolean
  ringing: boolean        // reached zero, alarm active until dismissed
}

export interface StopwatchState {
  startedAt: number | null   // epoch ms of the current run segment; null when paused
  accumulatedMs: number      // banked from prior segments
  running: boolean
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

export function elapsedMs(s: StopwatchState, now: number): number {
  return s.running && s.startedAt !== null ? s.accumulatedMs + (now - s.startedAt) : s.accumulatedMs
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
