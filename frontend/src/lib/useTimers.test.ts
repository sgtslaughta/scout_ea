import { renderHook, act } from '@testing-library/react'
import { vi, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./chime', () => ({ playChime: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { useTimers } from './useTimers'
import { playChime } from './chime'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); localStorage.clear() })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

it('fires the finish effect exactly once at zero-cross', () => {
  const { result } = renderHook(() => useTimers())
  act(() => { result.current.resetCountdown(1000) })
  act(() => { result.current.startCountdown() })
  act(() => { vi.setSystemTime(1500); vi.advanceTimersByTime(500) })
  expect(playChime).toHaveBeenCalledTimes(1)
  act(() => { vi.setSystemTime(2000); vi.advanceTimersByTime(500) })
  expect(playChime).toHaveBeenCalledTimes(1)     // not re-fired
})

it('persists to localStorage', () => {
  const { result } = renderHook(() => useTimers())
  act(() => { result.current.resetCountdown(120000) })
  const saved = JSON.parse(localStorage.getItem('ea-timers') || '{}')
  expect(saved.countdown.remainingMs).toBe(120000)
})
