import { it, expect } from 'vitest'
import * as T from './timers'

it('remainingMs: running derives from endsAt; paused uses stored', () => {
  expect(T.remainingMs({ endsAt: 1000, remainingMs: 999, running: true }, 400)).toBe(600)
  expect(T.remainingMs({ endsAt: 1000, remainingMs: 999, running: true }, 2000)).toBe(0) // clamped
  expect(T.remainingMs({ endsAt: null, remainingMs: 777, running: false }, 500)).toBe(777)
})

it('elapsedMs: running adds current segment; paused uses accumulated', () => {
  expect(T.elapsedMs({ startedAt: 100, accumulatedMs: 50, running: true }, 400)).toBe(350)
  expect(T.elapsedMs({ startedAt: null, accumulatedMs: 50, running: false }, 400)).toBe(50)
})

it('startCountdown arms endsAt = now + remaining', () => {
  const s = T.startCountdown({ endsAt: null, remainingMs: 5000, running: false }, 1000)
  expect(s).toEqual({ endsAt: 6000, remainingMs: 5000, running: true })
})

it('startCountdown no-ops when already running or nothing left', () => {
  const run = { endsAt: 6000, remainingMs: 5000, running: true }
  expect(T.startCountdown(run, 2000)).toBe(run)
  const zero = { endsAt: null, remainingMs: 0, running: false }
  expect(T.startCountdown(zero, 2000)).toBe(zero)
})

it('pauseCountdown banks remaining and clears endsAt', () => {
  const s = T.pauseCountdown({ endsAt: 6000, remainingMs: 5000, running: true }, 2000)
  expect(s).toEqual({ endsAt: null, remainingMs: 4000, running: false })
})

it('resetCountdown yields idle with given duration', () => {
  expect(T.resetCountdown(300000)).toEqual({ endsAt: null, remainingMs: 300000, running: false })
})

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
