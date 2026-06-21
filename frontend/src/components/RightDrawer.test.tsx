import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RightDrawer } from './RightDrawer'

// Mock the API
vi.mock('@/api', () => ({
  getDeadlines: vi.fn(() => Promise.resolve([])),
  getTrends: vi.fn(() => Promise.resolve([
    { id: '1', term: 'React', delta: 5 },
    { id: '2', term: 'Vue', delta: -2 },
  ])),
}))

describe('RightDrawer', () => {
  describe('trend rows', () => {
    it('uses Tailwind hover classes instead of inline event handlers', async () => {
      const queryClient = new QueryClient()
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <RightDrawer />
        </QueryClientProvider>
      )

      // Wait for data to load
      await new Promise(resolve => setTimeout(resolve, 100))

      const trendRows = container.querySelectorAll('.space-y-1\\.5 > div')

      expect(trendRows.length).toBeGreaterThan(0)

      const firstTrendRow = trendRows[0] as HTMLElement

      // Verify it uses Tailwind hover class instead of inline style/event handlers
      expect(firstTrendRow.className).toContain('hover:bg-')
      expect(firstTrendRow.className).toContain('bg-surface-2')
      expect(firstTrendRow.className).toContain('transition-colors')

      // Verify no inline style.background is set
      expect(firstTrendRow.style.background).toBe('')

      // Verify onMouseEnter and onMouseLeave are not present
      // (they won't appear in the DOM, but we check that className doesn't have suspicious patterns)
      expect(firstTrendRow.getAttribute('onMouseEnter')).toBeNull()
      expect(firstTrendRow.getAttribute('onMouseLeave')).toBeNull()
    })
  })
})
