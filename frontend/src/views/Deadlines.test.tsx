import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
      <QueryClientProvider client={queryClient}>
        <DeadlinesView />
      </QueryClientProvider>
    )

    const toggle = screen.getByRole('switch', { name: /Show all deadlines/i })
    expect(toggle).toBeDefined()
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('toggle button has correct CSS classes for styling', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DeadlinesView />
      </QueryClientProvider>
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
      <QueryClientProvider client={queryClient}>
        <DeadlinesView />
      </QueryClientProvider>
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
      <QueryClientProvider client={queryClient}>
        <DeadlinesView />
      </QueryClientProvider>
    )

    expect(screen.getByText('Show all deadlines')).toBeDefined()
  })
})
