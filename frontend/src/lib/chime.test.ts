import { describe, it, expect, vi, afterEach } from 'vitest'
import { startAlarm, stopAlarm, isAlarmRunning } from './chime'

afterEach(() => { stopAlarm(); vi.useRealTimers() })

describe('alarm loop', () => {
  it('plays immediately then on the interval', () => {
    vi.useFakeTimers()
    const beep = vi.fn()
    startAlarm(2000, beep)
    expect(beep).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000); expect(beep).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(2000); expect(beep).toHaveBeenCalledTimes(3)
  })
  it('is idempotent — a second start does not double the loop', () => {
    vi.useFakeTimers()
    const beep = vi.fn()
    startAlarm(2000, beep)
    startAlarm(2000, beep)      // ignored while running
    expect(beep).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000); expect(beep).toHaveBeenCalledTimes(2)
  })
  it('stopAlarm halts the loop', () => {
    vi.useFakeTimers()
    const beep = vi.fn()
    startAlarm(2000, beep)
    stopAlarm()
    expect(isAlarmRunning()).toBe(false)
    vi.advanceTimersByTime(4000); expect(beep).toHaveBeenCalledTimes(1)
  })
})
