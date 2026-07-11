import { describe, it, expect } from 'vitest'
import { urgencyOf, clockPercent, sameLocalDay, bucketDeadlines, inWorkday, clusterByProximity } from './horizon'
import type { Deadline } from '@/api'

function mk(partial: Partial<Deadline>): Deadline {
  return {
    id: 1, title: 'D', due_at: '2026-07-12T12:00:00', countdown_seconds: 3600,
    detail: '', source: 'manual', status: 'open', visible: 1, ...partial,
  }
}

describe('urgencyOf', () => {
  it('classifies by countdown boundaries', () => {
    expect(urgencyOf(-10)).toBe('critical')
    expect(urgencyOf(0)).toBe('critical')
    expect(urgencyOf(900)).toBe('critical')
    expect(urgencyOf(901)).toBe('urgent')
    expect(urgencyOf(7200)).toBe('urgent')
    expect(urgencyOf(7201)).toBe('soon')
    expect(urgencyOf(86400)).toBe('soon')
    expect(urgencyOf(86401)).toBe('normal')
  })
})

describe('clockPercent', () => {
  it('maps 7a->0, 6p->100, noon->~45, clamps outside', () => {
    const at = (h: number, m = 0) => new Date(2026, 6, 12, h, m)
    expect(clockPercent(at(7))).toBe(0)
    expect(clockPercent(at(18))).toBe(100)
    expect(Math.round(clockPercent(at(12)))).toBe(45)
    expect(clockPercent(at(5))).toBe(0)   // before window clamps
    expect(clockPercent(at(20))).toBe(100) // after window clamps
  })
})

describe('sameLocalDay', () => {
  it('compares calendar day', () => {
    expect(sameLocalDay(new Date(2026, 6, 12, 1), new Date(2026, 6, 12, 23))).toBe(true)
    expect(sameLocalDay(new Date(2026, 6, 12), new Date(2026, 6, 13))).toBe(false)
  })
})

describe('bucketDeadlines', () => {
  const now = new Date(2026, 6, 12, 10, 0) // noon-ish today

  it('puts today deadlines on axis, future in later', () => {
    const today = mk({ id: 1, due_at: new Date(2026, 6, 12, 14, 0).toISOString(), countdown_seconds: 14400 })
    const future = mk({ id: 2, due_at: new Date(2026, 6, 15, 9, 0).toISOString(), countdown_seconds: 3 * 86400 })
    const { onAxis, later } = bucketDeadlines([today, future], now)
    expect(onAxis.map((a) => a.deadline.id)).toEqual([1])
    expect(later.map((d) => d.id)).toEqual([2])
  })

  it('overdue from a past day clamps to 0% and is on axis', () => {
    const overdue = mk({ id: 3, due_at: new Date(2026, 6, 10, 9, 0).toISOString(), countdown_seconds: -100 })
    const { onAxis, later } = bucketDeadlines([overdue], now)
    expect(later).toHaveLength(0)
    expect(onAxis[0].percent).toBe(0)
    expect(onAxis[0].urgency).toBe('critical')
  })

  it('skips unparseable due_at', () => {
    const bad = mk({ id: 4, due_at: 'nope' })
    expect(bucketDeadlines([bad], now).onAxis).toHaveLength(0)
  })
})

describe('clockPercent with custom workday span', () => {
  const at = (h: number, m = 0) => new Date(2026, 6, 12, h, m)
  it('maps to the configured span', () => {
    expect(clockPercent(at(9), 9, 17)).toBe(0)
    expect(clockPercent(at(17), 9, 17)).toBe(100)
    expect(Math.round(clockPercent(at(13), 9, 17))).toBe(50)
    expect(clockPercent(at(7), 9, 17)).toBe(0) // before span clamps
  })
})

describe('inWorkday', () => {
  const at = (h: number) => new Date(2026, 6, 12, h, 0)
  it('checks the hour span (end exclusive)', () => {
    expect(inWorkday(at(9), 9, 17)).toBe(true)
    expect(inWorkday(at(8), 9, 17)).toBe(false)
    expect(inWorkday(at(17), 9, 17)).toBe(false)
    expect(inWorkday(at(12), 9, 17)).toBe(true)
  })
})

describe('clusterByProximity', () => {
  it('groups items within the threshold', () => {
    const items = [{ percent: 10, k: 'a' }, { percent: 12, k: 'b' }, { percent: 50, k: 'c' }]
    const cl = clusterByProximity(items, 4)
    expect(cl.length).toBe(2)
    expect(cl[0].items.map((i) => i.k)).toEqual(['a', 'b'])
    expect(cl[1].items.map((i) => i.k)).toEqual(['c'])
  })
})
