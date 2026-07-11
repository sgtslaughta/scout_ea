import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TasksView } from './Tasks'
import * as api from '@/api'

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

    expect(screen.getByText('Tasks')).toBeInTheDocument()
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
    expect(await screen.findByText("Today's Task")).toBeInTheDocument()
    expect(screen.queryByText("Tomorrow's Task")).not.toBeInTheDocument()
  })

  it('opens edit dialog when Edit button is clicked', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 5, title: 'Draft', detail: 'x', priority: 3, status: 'open' },
    ])

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TasksView />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await screen.findByText('Draft')
    const editButton = screen.getByLabelText('Edit')
    editButton.click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Edit task/i })).toBeInTheDocument()
    })
  })

  it('opens edit dialog and submits update', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 5, title: 'Draft', detail: 'x', priority: 3, status: 'open' },
    ])
    const upd = vi.spyOn(api, 'updateTask').mockResolvedValue({ updated: 1 })

    const user = userEvent.setup()
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TasksView />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await screen.findByText('Draft')
    await user.click(screen.getByLabelText('Edit'))
    const title = await screen.findByLabelText(/Title/i)
    await user.clear(title)
    await user.type(title, 'Draft 2')
    await user.click(screen.getByRole('button', { name: /Save/i }))
    await waitFor(() => expect(upd).toHaveBeenCalledWith(5, expect.objectContaining({ title: 'Draft 2' })))
  })
})
