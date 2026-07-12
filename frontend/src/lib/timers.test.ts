import { it, expect, describe } from 'vitest'
import * as T from './timers'

it('stopwatch start/pause banks accumulated across segments', () => {
  let s = T.resetStopwatch()
  s = T.startStopwatch(s, 1000)
  s = T.pauseStopwatch(s, 3000)          // +2000
  expect(s.accumulatedMs).toBe(2000)
  s = T.startStopwatch(s, 5000)
  s = T.pauseStopwatch(s, 6000)          // +1000
  expect(s.accumulatedMs).toBe(3000)
})

it('formatClock', () => {
  expect(T.formatClock(0)).toBe('00:00')
  expect(T.formatClock(65_000)).toBe('01:05')
  expect(T.formatClock(3_600_000)).toBe('1:00:00')
})

describe('multi-timer core', () => {
  const base: T.Timer = { id: 'a', label: 'X', durationMs: 1000, endsAt: null, remainingMs: 1000, running: false, ringing: false }

  it('makeTimer sets duration and remaining equal, idle', () => {
    const t = T.makeTimer('Tea', 60_000)
    expect(t.label).toBe('Tea')
    expect(t.durationMs).toBe(60_000)
    expect(t.remainingMs).toBe(60_000)
    expect(t.running).toBe(false)
    expect(t.ringing).toBe(false)
    expect(typeof t.id).toBe('string')
  })
  it('startTimer arms endsAt and clears ringing, preserves id/label', () => {
    const s = T.startTimer({ ...base, ringing: true }, 500)
    expect(s.endsAt).toBe(1500)
    expect(s.running).toBe(true)
    expect(s.ringing).toBe(false)
    expect(s.id).toBe('a'); expect(s.label).toBe('X')
  })
  it('remainingMs: running derives from endsAt, paused uses stored', () => {
    expect(T.remainingMs({ ...base, endsAt: 1500, running: true }, 900)).toBe(600)
    expect(T.remainingMs({ ...base, endsAt: 1500, running: true }, 9999)).toBe(0)
    expect(T.remainingMs({ ...base, remainingMs: 777, running: false }, 100)).toBe(777)
  })
  it('pauseTimer banks remaining', () => {
    const p = T.pauseTimer({ ...base, endsAt: 1500, running: true }, 900)
    expect(p.running).toBe(false); expect(p.remainingMs).toBe(600); expect(p.endsAt).toBeNull()
  })
  it('resetTimer restores durationMs and clears running/ringing', () => {
    const r = T.resetTimer({ ...base, remainingMs: 5, running: true, ringing: true, endsAt: 9 })
    expect(r.remainingMs).toBe(1000); expect(r.running).toBe(false); expect(r.ringing).toBe(false); expect(r.endsAt).toBeNull()
  })
})
