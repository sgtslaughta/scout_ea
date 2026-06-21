import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrendingView } from './Trending'

describe('Trending view', () => {
  let queryClient: QueryClient
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders trend term and score from seeded list', async () => {
    const mockTrends = [
      {
        id: 1,
        term: 'AI Integration',
        kind: 'topic',
        window_start: '2026-06-21T00:00:00',
        window_end: '2026-06-22T00:00:00',
        score: 8.5,
        delta: 2.3,
        count: 5,
      },
    ]

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/trends')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTrends),
        })
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TrendingView />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Integration')).toBeDefined()
      expect(screen.getByText('8.5')).toBeDefined()
    })
  })

  it('renders trend term with kind information', async () => {
    const mockTrends = [
      {
        id: 2,
        term: 'Machine Learning',
        kind: 'technology',
        window_start: '2026-06-21T00:00:00',
        window_end: '2026-06-22T00:00:00',
        score: 7.2,
        count: 3,
      },
    ]

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/trends')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTrends),
        })
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TrendingView />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Machine Learning')).toBeDefined()
      expect(screen.getByText(/technology/i)).toBeDefined()
    })
  })
})
