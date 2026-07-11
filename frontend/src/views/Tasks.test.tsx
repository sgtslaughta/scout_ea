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
      { id: 1, name: 'To Do', position: 0, status: 'open' },
      { id: 2, name: 'Done', position: 1, status: 'done' },
    ])
    vi.spyOn(api, 'getTasks').mockResolvedValue([])
  })

  it('renders heading and board columns', async () => {
    renderBoard()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    // 'To Do' is unique to the column header; the Done column is asserted via its status control
    // ('Done' also appears as a <option> in every status select).
    expect(await screen.findByText('To Do')).toBeInTheDocument()
    expect(screen.getByLabelText('Status for Done')).toBeInTheDocument()
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
    await waitFor(() => expect(add).toHaveBeenCalledWith('Blocked', 'open'))
  })

  it('Complete moves the task to the Done column and marks it done', async () => {
    const upd = vi.spyOn(api, 'updateTask').mockResolvedValue({ updated: 1 })
    vi.spyOn(api, 'getTasks').mockResolvedValue([mkTask({ id: 9, title: 'Finish', board_column_id: 1 })])
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Finish')
    await user.click(screen.getByLabelText('Complete'))
    // Done column has id 2 / status 'done' in the mock
    await waitFor(() => expect(upd).toHaveBeenCalledWith(9, { board_column_id: 2, status: 'done' }))
  })

  it('Dismiss without a dismissed column just sets status', async () => {
    const upd = vi.spyOn(api, 'updateTask').mockResolvedValue({ updated: 1 })
    vi.spyOn(api, 'getTasks').mockResolvedValue([mkTask({ id: 9, title: 'Junk', board_column_id: 1 })])
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Junk')
    await user.click(screen.getByLabelText('Dismiss'))
    await waitFor(() => expect(upd).toHaveBeenCalledWith(9, { status: 'dismissed' }))
  })

  it('hides dismissed tasks from the board', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      mkTask({ id: 1, title: 'Visible', board_column_id: 1 }),
      mkTask({ id: 2, title: 'Gone', board_column_id: 1, status: 'dismissed' }),
    ])
    renderBoard()
    expect(await screen.findByText('Visible')).toBeInTheDocument()
    expect(screen.queryByText('Gone')).not.toBeInTheDocument()
  })

  it('adds a new task via the Add task dialog', async () => {
    const create = vi.spyOn(api, 'createTask').mockResolvedValue({ id: 42 })
    const user = userEvent.setup()
    renderBoard()
    await user.click(await screen.findByRole('button', { name: /add task/i }))
    expect(await screen.findByRole('heading', { name: /add task/i })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Title/i), 'Brand new')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Brand new', status: 'open', board_column_id: 1 })))
  })

  it('converts a task to a deadline (task kept)', async () => {
    const add = vi.spyOn(api, 'addDeadline').mockResolvedValue({ id: 3 })
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      mkTask({ id: 7, title: 'Ship it', detail: 'the thing', due_at: '2026-08-01T00:00:00.000Z', board_column_id: 1 }),
    ])
    const user = userEvent.setup()
    renderBoard()
    await user.click(await screen.findByLabelText('Convert to deadline'))
    await user.click(await screen.findByRole('button', { name: /create deadline/i }))
    await waitFor(() => expect(add).toHaveBeenCalledWith('Ship it', expect.stringContaining('2026-08-01'), 'the thing'))
    // task still on the board
    expect(screen.getByText('Ship it')).toBeInTheDocument()
  })

  it('shows the per-column status control', async () => {
    renderBoard()
    // each column exposes a "sets <status>" select so drops map to a status
    expect(await screen.findByLabelText('Status for To Do')).toBeInTheDocument()
    expect(screen.getByLabelText('Status for Done')).toBeInTheDocument()
  })
})
