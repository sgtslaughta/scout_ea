export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night'

const DAY_MS = 86_400_000
const TWILIGHT_MS = 45 * 60_000  // 45 min window around sunrise/sunset

const ms = (t: string | Date) => (t instanceof Date ? t.getTime() : new Date(t).getTime())
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function skyPhase(now: string | Date, sunrise: string | Date, sunset: string | Date): SkyPhase {
  const n = ms(now), sr = ms(sunrise), ss = ms(sunset)
  if (Math.abs(n - sr) <= TWILIGHT_MS) return 'dawn'
  if (Math.abs(n - ss) <= TWILIGHT_MS) return 'dusk'
  return n > sr && n < ss ? 'day' : 'night'
}

/** Position 0..1 across the arc (0 = left horizon, 1 = right horizon). */
export function arcFraction(
  now: string | Date, sunrise: string | Date, sunset: string | Date, isDay: boolean,
): number {
  const n = ms(now), sr = ms(sunrise), ss = ms(sunset)
  if (isDay) return clamp01((n - sr) / (ss - sr))
  // night: span from sunset to next sunrise
  const span = sr + DAY_MS - ss
  const elapsed = n >= ss ? n - ss : n + DAY_MS - ss
  return clamp01(elapsed / span)
}
