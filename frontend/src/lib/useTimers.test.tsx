import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./chime', () => ({ playChime: vi.fn(), startAlarm: vi.fn(), stopAlarm: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { TimersProvider, useTimersContext } from './useTimers.tsx'
import { startAlarm } from './chime'

const wrapper = ({ children }: { children: ReactNode }) => <TimersProvider>{children}</TimersProvider>

beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers() })

describe('useTimers', () => {
  it('adds and removes timers', () => {
    const { result } = renderHook(() => useTimersContext(), { wrapper })
    act(() => result.current.addTimer('Tea', 1000))
    expect(result.current.timers).toHaveLength(1)
    const id = result.current.timers[0].id
    act(() => result.current.removeTimer(id))
    expect(result.current.timers).toHaveLength(0)
  })

  it('rings and triggers the continuous alarm at zero-cross', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { result } = renderHook(() => useTimersContext(), { wrapper })
    act(() => result.current.addTimer('T', 1000))
    const id = result.current.timers[0].id
    act(() => result.current.startTimer(id))
    act(() => { vi.setSystemTime(1500); vi.advanceTimersByTime(500) })
    expect(result.current.timers[0].ringing).toBe(true)
    expect(startAlarm).toHaveBeenCalled()
    act(() => result.current.dismissAlarm(id))
    expect(result.current.timers[0].ringing).toBe(false)
  })

  it('migrates the old { countdown } localStorage shape', () => {
    localStorage.setItem('ea-timers', JSON.stringify({ countdown: { endsAt: null, remainingMs: 120000, running: false }, stopwatch: { startedAt: null, accumulatedMs: 0, running: false } }))
    const { result } = renderHook(() => useTimersContext(), { wrapper })
    expect(result.current.timers).toHaveLength(1)
    expect(result.current.timers[0].label).toBe('Timer')
    expect(result.current.timers[0].remaining).toBe(120000)
  })
})
