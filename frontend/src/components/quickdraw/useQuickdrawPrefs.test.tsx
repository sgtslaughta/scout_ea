import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuickdrawPrefs } from './useQuickdrawPrefs'

beforeEach(() => localStorage.clear())

describe('useQuickdrawPrefs', () => {
  it('defaults: not expanded, no section collapsed', () => {
    const { result } = renderHook(() => useQuickdrawPrefs())
    expect(result.current.expanded).toBe(false)
    expect(result.current.isCollapsed('needs')).toBe(false)
  })

  it('persists expanded across remounts', () => {
    const first = renderHook(() => useQuickdrawPrefs())
    act(() => first.result.current.toggleExpanded())
    expect(first.result.current.expanded).toBe(true)
    const second = renderHook(() => useQuickdrawPrefs())
    expect(second.result.current.expanded).toBe(true)
  })

  it('persists collapsed section set', () => {
    const first = renderHook(() => useQuickdrawPrefs())
    act(() => first.result.current.toggleSection('recent'))
    expect(first.result.current.isCollapsed('recent')).toBe(true)
    const second = renderHook(() => useQuickdrawPrefs())
    expect(second.result.current.isCollapsed('recent')).toBe(true)
    expect(second.result.current.isCollapsed('needs')).toBe(false)
  })
})
