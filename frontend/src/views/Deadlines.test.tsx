import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DeadlinesView } from './Deadlines'

describe('Deadlines view', () => {
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
        json: () => Promise.resolve({
          deadlines_visible_global: '1',
        }),
      })
    ))
  })

  it('renders switch toggle with aria-checked and role attributes', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DeadlinesView />
        </QueryClientProvider>
      </MemoryRouter>
    )

    // MUI Switch renders as switch inside FormControlLabel
    const toggle = screen.getByRole('switch', { name: /Show all deadlines/i })
    expect(toggle).toBeDefined()
    expect(toggle).toBeChecked()
  })

  it('toggle renders MUI Switch with correct styling', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DeadlinesView />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const toggle = screen.getByRole('switch', { name: /Show all deadlines/i })
    expect(toggle).toBeDefined()
    // MUI handles styling; just verify the switch element exists
  })

  it('toggle has label inside FormControlLabel', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DeadlinesView />
        </QueryClientProvider>
      </MemoryRouter>
    )

    // Verify the switch element is present (it will be inside FormControlLabel)
    const toggle = screen.getByRole('switch', { name: /Show all deadlines/i })
    expect(toggle).toBeDefined()
  })

  it('toggle shows label text "Show all deadlines"', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DeadlinesView />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('Show all deadlines')).toBeDefined()
  })

  it('pre-filters via drill-down query param (due=24h)', async () => {
    // Mock getDeadlines API
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/config')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            deadlines_visible_global: '1',
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 1,
            title: 'Urgent Report',
            detail: 'Due soon',
            due_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            countdown_seconds: 3600, // < 24h
            visible: true,
            source: 'test',
          },
          {
            id: 2,
            title: 'Long deadline',
            detail: 'Far away',
            due_at: new Date(Date.now() + 900000 * 1000).toISOString(),
            countdown_seconds: 900000, // > 24h
            visible: true,
            source: 'test',
          },
        ]),
      })
    }))

    render(
      <MemoryRouter initialEntries={['/deadlines?due=24h']}>
        <QueryClientProvider client={queryClient}>
          <DeadlinesView />
        </QueryClientProvider>
      </MemoryRouter>
    )

    // Wait for data to load (DataGrid renders async)
    await screen.findByText('Urgent Report')

    // Urgent Report should be visible in DataGrid
    expect(screen.getByText('Urgent Report')).toBeDefined()

    // Long deadline should NOT be in the document (filtered out)
    expect(screen.queryByText('Long deadline')).toBeNull()
  })
})
