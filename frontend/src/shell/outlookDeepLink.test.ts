import { describe, it, expect } from 'vitest'
import { outlookCalendarUrl } from './outlookDeepLink'

describe('outlookCalendarUrl', () => {
  it('lands on the meeting\'s own day in the Outlook calendar', () => {
    const url = outlookCalendarUrl('2026-08-01T15:00:00Z')!
    expect(url).toContain('outlook.office.com/calendar/view/day')
    expect(url).toContain('date=')
  })

  it('uses the local calendar date, not the UTC one', () => {
    // A late-evening local meeting must not jump to the next day.
    const iso = new Date(2026, 7, 1, 21, 30).toISOString()
    expect(outlookCalendarUrl(iso)).toContain('date=2026-08-01')
  })

  it('returns null rather than a broken link for missing or unparseable times', () => {
    expect(outlookCalendarUrl(null)).toBeNull()
    expect(outlookCalendarUrl(undefined)).toBeNull()
    expect(outlookCalendarUrl('not a date')).toBeNull()
  })
})
