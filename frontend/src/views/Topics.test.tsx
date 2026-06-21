import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TopicsView } from './Topics'

describe('Topics view', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    // Mock the API
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    ))
  })

  it('renders Topics heading', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TopicsView />
      </QueryClientProvider>
    )

    expect(screen.getByText('Topics')).toBeDefined()
  })
})
