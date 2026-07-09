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

    const toggle = screen.getByRole('switch', { name: /Show all deadlines/i })
    expect(toggle).toBeDefined()
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('toggle button has correct CSS classes for styling', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DeadlinesView />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const toggle = screen.getByRole('switch', { name: /Show all deadlines/i })
    expect(toggle.className).toContain('relative')
    expect(toggle.className).toContain('inline-flex')
    expect(toggle.className).toContain('h-6')
    expect(toggle.className).toContain('w-11')
    expect(toggle.className).toContain('rounded-full')
  })

  it('toggle contains styled span for the switch knob', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DeadlinesView />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const toggle = screen.getByRole('switch', { name: /Show all deadlines/i })
    const knob = toggle.querySelector('span')
    expect(knob).toBeDefined()
    expect(knob?.className).toContain('inline-block')
    expect(knob?.className).toContain('h-5')
    expect(knob?.className).toContain('w-5')
    expect(knob?.className).toContain('rounded-full')
    expect(knob?.className).toContain('transform')
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

    // Wait for data to load
    await screen.findByText('Urgent Report')

    // Urgent Report should be visible
    expect(screen.getByText('Urgent Report')).toBeDefined()

    // Long deadline should NOT be in the document
    expect(screen.queryByText('Long deadline')).toBeNull()
  })
})
