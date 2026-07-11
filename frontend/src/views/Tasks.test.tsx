import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TasksView } from './Tasks'
import * as api from '@/api'
import type { Task } from '@/api'

function mkTask(p: Partial<Task>): Task {
  return { id: 1, title: 'T', priority: 3, status: 'open', board_column_id: null, ...p }
}

function renderBoard(path = '/tasks') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}><TasksView /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Tasks board', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getBoardColumns').mockResolvedValue([
      { id: 1, name: 'To Do', position: 0 },
      { id: 2, name: 'Done', position: 1 },
    ])
    vi.spyOn(api, 'getTasks').mockResolvedValue([])
  })

  it('renders heading and board columns', async () => {
    renderBoard()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(await screen.findByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('places a task in the first column (null board_column_id)', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([mkTask({ id: 5, title: 'Draft', board_column_id: null })])
    renderBoard()
    expect(await screen.findByText('Draft')).toBeInTheDocument()
  })

  it('filters by due=today drill-down', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      mkTask({ id: 1, title: 'Today task', due_at: new Date().toISOString() }),
      mkTask({ id: 2, title: 'Tomorrow task', due_at: new Date(Date.now() + 86400000).toISOString() }),
    ])
    renderBoard('/tasks?due=today')
    expect(await screen.findByText('Today task')).toBeInTheDocument()
    expect(screen.queryByText('Tomorrow task')).not.toBeInTheDocument()
  })

  it('opens the edit modal on card click and submits', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([mkTask({ id: 5, title: 'Draft', detail: 'x' })])
    const upd = vi.spyOn(api, 'updateTask').mockResolvedValue({ updated: 1 })
    const user = userEvent.setup()
    renderBoard()
    await user.click(await screen.findByText('Draft'))
    const title = await screen.findByLabelText(/Title/i)
    await user.clear(title); await user.type(title, 'Draft 2')
    await user.click(screen.getByRole('button', { name: /Save/i }))
    await waitFor(() => expect(upd).toHaveBeenCalledWith(5, expect.objectContaining({ title: 'Draft 2' })))
  })

  it('adds a column', async () => {
    const add = vi.spyOn(api, 'addBoardColumn').mockResolvedValue({ id: 3 })
    const user = userEvent.setup()
    renderBoard()
    await user.click(await screen.findByRole('button', { name: /add column/i }))
    const input = screen.getByPlaceholderText(/column name/i)
    await user.type(input, 'Blocked{Enter}')
    await waitFor(() => expect(add).toHaveBeenCalledWith('Blocked'))
  })
})
