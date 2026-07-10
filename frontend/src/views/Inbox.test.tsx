import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { InboxView } from './Inbox'

describe('Inbox view', () => {
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

  it('renders Inbox heading', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InboxView />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText('Inbox')).toBeInTheDocument()
  })

  it('pre-filters via drill-down query param (status/type)', async () => {
    // Mock signals with different status and type combinations
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 1,
            title: 'Important Alert',
            status: 'new',
            type: 'proactive',
            priority: 1,
            source: 'test',
            source_skill: null,
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            title: 'Routine Signal',
            status: 'new',
            type: 'reactive',
            priority: 2,
            source: 'test',
            source_skill: null,
            created_at: new Date().toISOString(),
          },
        ]),
      })
    ))

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/inbox?status=new&type=proactive']}>
          <InboxView />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Wait for DataGrid content to load (rows are async-rendered divs)
    expect(await screen.findByText('Important Alert')).toBeInTheDocument()
    expect(screen.queryByText('Routine Signal')).not.toBeInTheDocument()
  })
})
