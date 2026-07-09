import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    it('renders trend items with chip labels', async () => {
      const queryClient = new QueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <RightDrawer />
        </QueryClientProvider>
      )

      // Wait for data to load
      await new Promise(resolve => setTimeout(resolve, 100))

      // Query by text content instead of Tailwind classes
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('Vue')).toBeInTheDocument()

      // Verify chip labels render correctly
      expect(screen.getByText('+5%')).toBeInTheDocument()
      expect(screen.getByText('-2%')).toBeInTheDocument()
    })
  })
})
