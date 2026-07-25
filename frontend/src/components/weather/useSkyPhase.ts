import { useEffect, useState } from 'react'
import { skyPhase, type SkyPhase } from './sky'

/**
 * Single source of truth for the live sky clock. Ticks every 60s so any
 * consumer (WeatherBand, TodayBriefing's full-bleed backdrop, ...) agrees on
 * the current phase — a fixed `nowOverride` (tests / controlled render)
 * freezes it instead.
 */
export function useSkyPhase(
  sunrise?: string | Date,
  sunset?: string | Date,
  nowOverride?: Date,
): { now: Date; phase: SkyPhase } {
  const [clock, setClock] = useState<Date>(() => nowOverride ?? new Date())

  useEffect(() => {
    if (nowOverride) return
    const id = setInterval(() => setClock(new Date()), 60_000)
    return () => clearInterval(id)
  }, [nowOverride])

  const now = nowOverride ?? clock
  const phase: SkyPhase = sunrise && sunset ? skyPhase(now, sunrise, sunset) : 'day'

  return { now, phase }
}
