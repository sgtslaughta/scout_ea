/**
 * Reactive time-format preferences (timezone + 24h), persisted to localStorage.
 * Wrap the app in <TimePrefsProvider>; read via useTimePrefs() (settings) or
 * useFriendlyTime() (call sites). Changing a pref re-renders consumers live.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_TIME_PREFS, formatFriendly, type TimePrefs } from './datetime'

const TZ_KEY = 'ea-timezone'
const H24_KEY = 'ea-time-24h'

interface TimePrefsCtx extends TimePrefs {
  setTimeZone: (tz: string) => void
  setHour24: (v: boolean) => void
}

const Ctx = createContext<TimePrefsCtx | null>(null)

function load(): TimePrefs {
  return {
    timeZone: localStorage.getItem(TZ_KEY) || DEFAULT_TIME_PREFS.timeZone,
    hour24: localStorage.getItem(H24_KEY) === 'true',
  }
}

export function TimePrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<TimePrefs>(load)

  const setTimeZone = useCallback((tz: string) => {
    localStorage.setItem(TZ_KEY, tz)
    setPrefs((p) => ({ ...p, timeZone: tz }))
  }, [])
  const setHour24 = useCallback((v: boolean) => {
    localStorage.setItem(H24_KEY, String(v))
    setPrefs((p) => ({ ...p, hour24: v }))
  }, [])

  const value = useMemo<TimePrefsCtx>(
    () => ({ ...prefs, setTimeZone, setHour24 }),
    [prefs, setTimeZone, setHour24],
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
