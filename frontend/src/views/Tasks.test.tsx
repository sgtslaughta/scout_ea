import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TasksView } from './Tasks'

describe('Tasks view', () => {
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

  it('renders Tasks heading', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TasksView />
      </QueryClientProvider>
    )

    expect(screen.getByText('Tasks')).toBeDefined()
  })
})
