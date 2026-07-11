import { describe, it, expect } from 'vitest'
import { buildApproaching, buildNeedsResponse, formatCountdown, URGENCY_CHIP } from './quickdrawData'
import type { Deadline, Task, EventItem, Signal, Alert } from '@/api'

const now = new Date('2026-07-11T12:00:00Z')
const iso = (ms: number) => new Date(now.getTime() + ms).toISOString()

function dl(p: Partial<Deadline>): Deadline {
  return { id: 1, title: 'D', due_at: iso(3600_000), countdown_seconds: 3600, detail: '', source: 'manual', status: 'open', visible: 1, ...p }
}

describe('formatCountdown', () => {
  it('overdue → now', () => expect(formatCountdown(0)).toBe('now'))
  it('mins only', () => expect(formatCountdown(45 * 60)).toBe('45m'))
  it('hours + mins', () => expect(formatCountdown(2 * 3600 + 5 * 60)).toBe('2h 5m'))
})

describe('buildApproaching', () => {
  it('keeps items within 24h, sorts soonest first, drops done tasks and far items', () => {
    const deadlines = [dl({ id: 1, countdown_seconds: 7200, due_at: iso(7200_000) }), dl({ id: 2, countdown_seconds: 200000, due_at: iso(200000_000) })]
    const tasks: Task[] = [
      { id: 5, title: 'soon task', due_at: iso(1800_000), priority: 2, status: 'open' },
      { id: 6, title: 'done task', due_at: iso(600_000), priority: 2, status: 'done' },
    ]
    const events: EventItem[] = [{ id: 9, title: 'mtg', chosen_time: iso(3600_000), status: 'confirmed' }]
    const out = buildApproaching(deadlines, tasks, events, now)
    expect(out.map((i) => i.key)).toEqual(['t5', 'e9', 'd1']) // 1800s, 3600s, 7200s
    expect(out.find((i) => i.id === 2)).toBeUndefined() // >24h dropped
    expect(out.find((i) => i.title === 'done task')).toBeUndefined()
  })
})

describe('buildNeedsResponse', () => {
  it('merges signals + alerts ranked by priority/severity', () => {
    const signals: Signal[] = [{ id: 1, type: 'email', source: 'inbox', title: 'lo', status: 'new', priority: 5, created_at: '', summary: 'sum' }]
    const alerts: Alert[] = [{ id: 2, severity: 'critical', title: 'hi', status: 'unread', created_at: '', body: 'boom' }]
    const out = buildNeedsResponse(signals, alerts)
    expect(out[0].kind).toBe('alert') // rank 0 < 5
    expect(out[0].detail).toBe('boom')
    expect(out[1].detail).toBe('sum')
  })
})

describe('URGENCY_CHIP', () => {
  it('maps every urgency tier', () => {
    expect(URGENCY_CHIP.critical).toBe('error')
    expect(URGENCY_CHIP.normal).toBe('default')
  })
})
