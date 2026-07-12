import React, { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { playChime, startAlarm, stopAlarm } from './chime'
import * as T from './timers'

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
