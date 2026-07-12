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
