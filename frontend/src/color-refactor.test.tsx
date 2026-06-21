import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TodayView } from './views/Today'
import { DeadlinesView } from './views/Deadlines'
import { TrendingView } from './views/Trending'
import { SignatureBar } from './components/SignatureBar'
import { RightDrawer } from './components/RightDrawer'

const mockQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

const mockFetch = () => {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        deadlines: [],
        top_trends: [],
        proactive: [],
        tasks_due_today: [],
        config: {}
      }),
    })
  ))
}

describe('Color refactor: no hardcoded hex colors', () => {
  beforeEach(() => {
    mockFetch()
  })

  it('Today.tsx: main element should not have hardcoded #0B1220 background', () => {
    const queryClient = mockQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TodayView />
      </QueryClientProvider>
    )
    const mainEl = container.querySelector('main')
    expect(mainEl).toBeDefined()
    // Should use bg-bg class or have background removed from inline style
    const inlineStyle = mainEl?.getAttribute('style')
    expect(inlineStyle).not.toContain('#0B1220')
  })

  it('Deadlines.tsx: main element should not have hardcoded #0B1220 background', () => {
    const queryClient = mockQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <DeadlinesView />
      </QueryClientProvider>
    )
    const mainEl = container.querySelector('main')
    expect(mainEl).toBeDefined()
    const inlineStyle = mainEl?.getAttribute('style')
    expect(inlineStyle).not.toContain('#0B1220')
  })

  it('Trending.tsx: main element should not have hardcoded #0B1220 background', () => {
    const queryClient = mockQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TrendingView />
      </QueryClientProvider>
    )
    const mainEl = container.querySelector('main')
    expect(mainEl).toBeDefined()
    const inlineStyle = mainEl?.getAttribute('style')
    expect(inlineStyle).not.toContain('#0B1220')
  })

  it('SignatureBar.tsx: gradient should use CSS vars not hardcoded hex', () => {
    const { container } = render(<SignatureBar />)
    const horizon = container.querySelector('[data-horizon]')
    expect(horizon).toBeDefined()
    const inlineStyle = horizon?.getAttribute('style')
    // Should reference var(--color-*) not hardcoded hex
    if (inlineStyle) {
      expect(inlineStyle).not.toContain('linear-gradient(90deg,#F2A65A,#6C8FE5)')
    }
  })

  it('RightDrawer.tsx: container should not have hardcoded #0B1220', () => {
    const queryClient = mockQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <RightDrawer />
      </QueryClientProvider>
    )
    const drawer = container.querySelector('div[class*="w-\\[300px\\]"]') || container.firstChild
    expect(drawer).toBeDefined()
    const inlineStyle = drawer?.getAttribute('style')
    expect(inlineStyle).not.toContain('#0B1220')
  })

  it('RightDrawer.tsx: trending items should not have hardcoded #1C2840', () => {
    const queryClient = mockQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <RightDrawer />
      </QueryClientProvider>
    )
    const elements = container.querySelectorAll('[style*="#1C2840"]')
    expect(elements.length).toBe(0)
  })
})
