/**
 * Friendly absolute-timestamp formatting, timezone + 12/24h aware.
 * Example: formatFriendly(iso, { timeZone: 'America/New_York', hour24: false })
 *          -> "Friday July 12th @ 1:45pm EST"
 * Relative displays (relativeTime / formatCountdown) are intentionally NOT here —
 * they carry no absolute clock and need no timezone.
 */

export interface TimePrefs {
  /** IANA zone id, or 'auto' for the browser's local zone. */
  timeZone: string
  /** true = 24-hour clock (13:45), false = 12-hour (1:45pm). */
  hour24: boolean
}

export const DEFAULT_TIME_PREFS: TimePrefs = { timeZone: 'auto', hour24: false }

/** Curated timezone options for the settings picker (id 'auto' = browser-local). */
export const COMMON_ZONES: { id: string; label: string }[] = [
  { id: 'auto', label: 'Auto (browser)' },
  { id: 'America/New_York', label: 'Eastern (ET)' },
  { id: 'America/Chicago', label: 'Central (CT)' },
  { id: 'America/Denver', label: 'Mountain (MT)' },
  { id: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { id: 'UTC', label: 'UTC' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Australia/Sydney', label: 'Sydney' },
]

/** Ordinal suffix: 1 -> "1st", 12 -> "12th", 23 -> "23rd". */
export function ordinal(day: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = day % 100
  return `${day}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

/** Resolve 'auto' to undefined (browser-local) for Intl; pass through IANA ids. */
function resolveZone(timeZone: string): string | undefined {
  return timeZone && timeZone !== 'auto' ? timeZone : undefined
}

/** The IANA zone actually in effect (resolves 'auto' to the detected zone). */
export function effectiveZone(timeZone: string): string {
  return resolveZone(timeZone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * "Friday July 12th @ 1:45pm EST" (or "... @ 13:45 EST" when hour24).
 * Returns '' for null/invalid input so callers can render nothing safely.
 */
export function formatFriendly(iso: string | number | Date | null | undefined, prefs: TimePrefs): string {
  if (iso == null || iso === '') return ''
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: !prefs.hour24,
    timeZoneName: 'short', timeZone: resolveZone(prefs.timeZone),
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const day = Number(get('day'))
  const time = prefs.hour24
    ? `${get('hour').padStart(2, '0')}:${get('minute')}`
    : `${get('hour')}:${get('minute')}${get('dayPeriod').toLowerCase()}`
  return `${get('weekday')} ${get('month')} ${ordinal(day)} @ ${time} ${get('timeZoneName')}`.trim()
}

/** Clock time only: "1:45pm" (12h) or "13:45" (24h), timezone-aware. '' on invalid. */
export function formatClock(iso: string | number | Date | null | undefined, prefs: TimePrefs): string {
  if (iso == null || iso === '') return ''
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: !prefs.hour24,
    timeZone: resolveZone(prefs.timeZone),
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return prefs.hour24
    ? `${get('hour').padStart(2, '0')}:${get('minute')}`
    : `${get('hour')}:${get('minute')}${get('dayPeriod').toLowerCase()}`
}

// ponytail: runnable self-check — `npx tsx src/lib/datetime.ts` or via the vitest suite.
export function _demo(): void {
  const iso = '2026-07-12T17:45:00Z' // 1:45pm EDT (America/New_York in July)
  const twelve = formatFriendly(iso, { timeZone: 'America/New_York', hour24: false })
  const twentyfour = formatFriendly(iso, { timeZone: 'America/New_York', hour24: true })
  // weekday name is date-derived; assert the parts we control, not the day-of-week.
  console.assert(/^\w+ July 12th @ 1:45pm EDT$/.test(twelve), `12h: ${twelve}`)
  console.assert(/^\w+ July 12th @ 13:45 EDT$/.test(twentyfour), `24h: ${twentyfour}`)
  console.assert(ordinal(21) === '21st' && ordinal(12) === '12th' && ordinal(3) === '3rd', 'ordinal')
  console.assert(formatFriendly('', DEFAULT_TIME_PREFS) === '', 'empty -> empty')
}
