import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
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
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <TrendingView />
        </QueryClientProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Integration')).toBeInTheDocument()
      expect(screen.getByText('8.5')).toBeInTheDocument()
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
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <TrendingView />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Machine Learning')).toBeInTheDocument()
      expect(screen.getByText(/technology/i)).toBeInTheDocument()
    })
  })

  it('pre-filters via drill-down query param (dir=rising)', async () => {
    const mockTrends = [
      {
        id: 1,
        term: 'Growing Trend',
        kind: 'topic',
        window_start: '2026-06-21T00:00:00',
        window_end: '2026-06-22T00:00:00',
        score: 8.5,
        delta: 2.3,
        count: 5,
      },
      {
        id: 2,
        term: 'Declining Trend',
        kind: 'topic',
        window_start: '2026-06-21T00:00:00',
        window_end: '2026-06-22T00:00:00',
        score: 6.0,
        delta: -1.0,
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
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={['/trending?dir=rising']}>
            <TrendingView />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )

    // Wait for data to load
    await screen.findByText('Growing Trend')

    // Growing Trend should be visible
    expect(screen.getByText('Growing Trend')).toBeInTheDocument()

    // Declining Trend should NOT be in the document
    expect(screen.queryByText('Declining Trend')).not.toBeInTheDocument()
  })
})
