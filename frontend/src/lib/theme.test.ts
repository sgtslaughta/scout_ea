import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveTheme, applyTheme, getStoredMode, setStoredMode, type ThemeMode } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light')
  })

  describe('resolveTheme', () => {
    it('returns light when mode is light', () => {
      expect(resolveTheme('light')).toBe('light')
    })

    it('returns dark when mode is dark', () => {
      expect(resolveTheme('dark')).toBe('dark')
    })

    it('returns system preference when mode is system', () => {
      // ponytail: stub matchMedia in jsdom
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockReturnValue({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }),
      })
      expect(resolveTheme('system')).toBe('light')
    })
  })

  describe('applyTheme', () => {
    it('adds light class when resolved to light', () => {
      applyTheme('light')
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })

    it('removes light class when resolved to dark', () => {
      document.documentElement.classList.add('light')
      applyTheme('dark')
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })
  })

  describe('getStoredMode', () => {
    it('returns system default when nothing stored', () => {
      expect(getStoredMode()).toBe('system')
    })

    it('returns stored mode', () => {
      localStorage.setItem('ea-theme', 'light')
      expect(getStoredMode()).toBe('light')
    })
  })

  describe('setStoredMode', () => {
    it('stores and applies theme', () => {
      setStoredMode('light')
      expect(localStorage.getItem('ea-theme')).toBe('light')
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })
  })
})
