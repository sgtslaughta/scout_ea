import { describe, it, expect } from 'vitest'
import { currentMonth, monthOptions, monthLabel } from './months'

describe('currentMonth', () => {
  it('formats as YYYY-MM', () => {
    expect(currentMonth(new Date(2026, 2, 15))).toBe('2026-03')
  })
})

describe('monthOptions', () => {
  it('spans months on either side of center, including year rollover', () => {
    const opts = monthOptions('2026-01', 2)
    expect(opts).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'])
  })
})

describe('monthLabel', () => {
  it('renders a friendly label', () => {
    expect(monthLabel('2026-03')).toMatch(/March\s+2026/)
  })
})
