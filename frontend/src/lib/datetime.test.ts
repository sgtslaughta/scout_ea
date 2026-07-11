import { describe, it, expect } from 'vitest'
import { formatFriendly, ordinal, effectiveZone, _demo } from './datetime'

describe('formatFriendly', () => {
  const iso = '2026-07-12T17:45:00Z' // 1:45pm EDT in America/New_York

  it('formats 12-hour with lowercase meridiem, ordinal day, and tz abbr', () => {
    const s = formatFriendly(iso, { timeZone: 'America/New_York', hour24: false })
    expect(s).toMatch(/^\w+ July 12th @ 1:45pm EDT$/)
  })

  it('formats 24-hour without meridiem', () => {
    const s = formatFriendly(iso, { timeZone: 'America/New_York', hour24: true })
    expect(s).toMatch(/^\w+ July 12th @ 13:45 EDT$/)
  })

  it('respects timezone (UTC shifts the clock)', () => {
    const s = formatFriendly(iso, { timeZone: 'UTC', hour24: true })
    expect(s).toMatch(/@ 17:45 UTC$/)
  })

  it('returns empty string for null/invalid input', () => {
    expect(formatFriendly(null, { timeZone: 'auto', hour24: false })).toBe('')
    expect(formatFriendly('not-a-date', { timeZone: 'auto', hour24: false })).toBe('')
  })
})

describe('ordinal', () => {
  it('handles st/nd/rd/th and teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd'],
    )
  })
})

describe('effectiveZone', () => {
  it('resolves auto to a concrete IANA zone', () => {
    expect(effectiveZone('auto')).toBeTruthy()
    expect(effectiveZone('UTC')).toBe('UTC')
  })
})

describe('_demo self-check', () => {
  it('runs without assertion failures', () => {
    expect(() => _demo()).not.toThrow()
  })
})
