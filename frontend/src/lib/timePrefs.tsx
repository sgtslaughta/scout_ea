/**
 * Reactive time-format preferences (timezone + 24h), persisted to localStorage.
 * Wrap the app in <TimePrefsProvider>; read via useTimePrefs() (settings) or
 * useFriendlyTime() (call sites). Changing a pref re-renders consumers live.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_TIME_PREFS, formatFriendly, formatClock, type TimePrefs } from './datetime'

const TZ_KEY = 'ea-timezone'
const H24_KEY = 'ea-time-24h'
const WD_START_KEY = 'ea-workday-start'
const WD_END_KEY = 'ea-workday-end'

export const DEFAULT_WORKDAY = { start: 7, end: 18 }

interface StoredPrefs extends TimePrefs {
  workdayStart: number
  workdayEnd: number
}

interface TimePrefsCtx extends StoredPrefs {
  setTimeZone: (tz: string) => void
  setHour24: (v: boolean) => void
  setWorkday: (start: number, end: number) => void
}

const Ctx = createContext<TimePrefsCtx | null>(null)

function loadNum(key: string, fallback: number): number {
  const raw = localStorage.getItem(key)
  if (raw === null || raw === '') return fallback
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback
}

function load(): StoredPrefs {
  return {
    timeZone: localStorage.getItem(TZ_KEY) || DEFAULT_TIME_PREFS.timeZone,
    hour24: localStorage.getItem(H24_KEY) === 'true',
    workdayStart: loadNum(WD_START_KEY, DEFAULT_WORKDAY.start),
    workdayEnd: loadNum(WD_END_KEY, DEFAULT_WORKDAY.end),
  }
}

export function TimePrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<StoredPrefs>(load)

  const setTimeZone = useCallback((tz: string) => {
    localStorage.setItem(TZ_KEY, tz)
    setPrefs((p) => ({ ...p, timeZone: tz }))
  }, [])
  const setHour24 = useCallback((v: boolean) => {
    localStorage.setItem(H24_KEY, String(v))
    setPrefs((p) => ({ ...p, hour24: v }))
  }, [])
  const setWorkday = useCallback((start: number, end: number) => {
    localStorage.setItem(WD_START_KEY, String(start))
    localStorage.setItem(WD_END_KEY, String(end))
    setPrefs((p) => ({ ...p, workdayStart: start, workdayEnd: end }))
  }, [])

  const value = useMemo<TimePrefsCtx>(
    () => ({ ...prefs, setTimeZone, setHour24, setWorkday }),
    [prefs, setTimeZone, setHour24, setWorkday],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTimePrefs(): TimePrefsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTimePrefs must be used within TimePrefsProvider')
  return ctx
}

/**
 * Bound formatter that tracks the current prefs. `friendly(iso)` -> friendly string.
 * Resilient by design: outside a provider (e.g. isolated component tests) it falls
 * back to localStorage-backed defaults rather than throwing.
 */
export function useFriendlyTime(): (iso: string | number | Date | null | undefined) => string {
  const ctx = useContext(Ctx)
  const { timeZone, hour24 } = ctx ?? load()
  return useCallback((iso) => formatFriendly(iso, { timeZone, hour24 }), [timeZone, hour24])
}

/** Like useFriendlyTime but clock-only ("1:45pm" / "13:45"). Same fallback behavior. */
export function useClockFormat(): (iso: string | number | Date | null | undefined) => string {
  const ctx = useContext(Ctx)
  const { timeZone, hour24 } = ctx ?? load()
  return useCallback((iso) => formatClock(iso, { timeZone, hour24 }), [timeZone, hour24])
}

/** The current effective timezone pref ('auto' or an IANA id). Resilient: no throw outside a provider. */
export function useTimeZone(): string {
  const ctx = useContext(Ctx)
  return (ctx ?? load()).timeZone
}

/** The workday span (start/end hours) for the timeline. Resilient: no throw outside a provider. */
export function useWorkday(): { start: number; end: number } {
  const ctx = useContext(Ctx)
  const p = ctx ?? load()
  return { start: p.workdayStart, end: p.workdayEnd }
}
