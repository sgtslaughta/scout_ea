import { safeHttpUrl } from '@/lib/url'

const OUTLOOK_CALENDAR = 'https://outlook.office.com/calendar/view/day'

/**
 * Deep link that pivots the user into their Microsoft 365 Outlook calendar,
 * opened on the day the meeting falls.
 *
 * Deliberately day-scoped rather than item-scoped: an item deep link needs
 * Outlook's own immutable item id, which this app never sees — Scout writes
 * events in through MCP and only carries its own `external_ref`. Guessing at
 * an item id would produce links that 404, so we land the user on the right
 * day and let them see the meeting in context.
 */
export function outlookCalendarUrl(iso: string | null | undefined): string | null {
  if (!iso) return null
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return null
  // Local calendar date, not UTC — a 9pm EDT meeting is still "today" to the user.
  const date = [
    when.getFullYear(),
    String(when.getMonth() + 1).padStart(2, '0'),
    String(when.getDate()).padStart(2, '0'),
  ].join('-')
  return safeHttpUrl(`${OUTLOOK_CALENDAR}?date=${date}`)
}
