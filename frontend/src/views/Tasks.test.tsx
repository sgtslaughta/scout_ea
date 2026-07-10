import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
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
        <MemoryRouter>
          <TasksView />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText('Tasks')).toBeDefined()
  })

  it('pre-filters via drill-down query param (due=today)', async () => {
    const today = new Date()
    const tomorrow = new Date(Date.now() + 86400000)

    const mockTasks = [
      {
        id: 1,
        title: "Today's Task",
        detail: null,
        due_at: today.toISOString(),
        status: 'open',
        priority: 1,
      },
      {
        id: 2,
        title: "Tomorrow's Task",
        detail: null,
        due_at: tomorrow.toISOString(),
        status: 'open',
        priority: 1,
      },
    ]

    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTasks),
      })
    ))

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/tasks?due=today']}>
          <TasksView />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Wait for DataGrid content to load (rows are async-rendered divs)
    expect(await screen.findByText("Today's Task")).toBeDefined()
    expect(screen.queryByText("Tomorrow's Task")).toBeNull()
  })
})
