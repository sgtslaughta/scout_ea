import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TodayView } from './Today'

describe('Today view', () => {
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
        json: () => Promise.resolve({ deadlines: [], top_trends: [], proactive: [], tasks_due_today: [] }),
      })
    ))
  })

  it('renders TODAY header', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TodayView />
      </QueryClientProvider>
    )
    const header = screen.getByRole('heading', { name: /TODAY/i })
    expect(header).toBeDefined()
  })
})
