import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Polyfill ResizeObserver for cmdk component
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Polyfill scrollIntoView for cmdk
Element.prototype.scrollIntoView = vi.fn()
