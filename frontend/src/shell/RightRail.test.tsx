import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { DragEndEvent } from '@dnd-kit/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { RightRail, reorderIds, createDragEndHandler } from './RightRail'
import * as api from '@/api'

// The real DndContext requires pointer events jsdom can't simulate. We
// capture the onDragEnd handler it's given so tests can invoke it directly.
let capturedOnDragEnd: ((event: DragEndEvent) => void) | undefined
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: (props: { onDragEnd: (event: DragEndEvent) => void; children: React.ReactNode }) => {
      capturedOnDragEnd = props.onDragEnd
      return props.children
    },
  }
})

function renderRail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <RightRail />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('RightRail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    capturedOnDragEnd = undefined
    vi.spyOn(api, 'updateTask').mockResolvedValue({ updated: 1 })
    vi.spyOn(api, 'createTask').mockResolvedValue({ id: 99 })
  })

  it('renders the To do heading', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([])
    renderRail()
    expect(screen.getByRole('heading', { name: 'To do' })).toBeInTheDocument()
  })

  it('shows a friendly empty state when there are no tasks', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([])
    renderRail()
    expect(await screen.findByText('Nothing to do yet. Add your first task.')).toBeInTheDocument()
  })

  it('renders real tasks in the order returned by the API', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 1, title: 'Write report', status: 'open', priority: 3, sort: 0 },
      { id: 2, title: 'Review PR', status: 'in_progress', priority: 3, sort: 1 },
    ])
    renderRail()
    expect(await screen.findByText('Write report')).toBeInTheDocument()
    expect(screen.getByText('Review PR')).toBeInTheDocument()
  })

  it('cycles the status box and PATCHes the new status', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 1, title: 'Write report', status: 'open', priority: 3, sort: 0 },
    ])
    renderRail()
    fireEvent.click(await screen.findByRole('button', { name: /mark as done/i }))
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith(1, { status: 'done' }))
  })

  it('persists the new order on drag end', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 1, title: 'A', status: 'open', priority: 3, sort: 0 },
      { id: 2, title: 'B', status: 'open', priority: 3, sort: 1 },
    ])
    renderRail()
    await screen.findByText('A')
    expect(capturedOnDragEnd).toBeDefined()
    capturedOnDragEnd!({ active: { id: 1 }, over: { id: 2 } } as DragEndEvent)
    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith(1, { sort: 1 })
      expect(api.updateTask).toHaveBeenCalledWith(2, { sort: 0 })
    })
  })

  it('adds a task on Enter and clears the input', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([])
    renderRail()
    const input = await screen.findByRole('textbox', { name: /add a task/i })
    fireEvent.change(input, { target: { value: 'Buy milk' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(api.createTask).toHaveBeenCalledWith({ title: 'Buy milk' }))
    expect(input).toHaveValue('')
  })

  it('reorderIds maps a drag end to the new id order', () => {
    expect(reorderIds([1, 2, 3], 1, 3)).toEqual([2, 3, 1])
    expect(reorderIds([1, 2, 3], 3, 1)).toEqual([3, 1, 2])
    // no-op when dropped without a valid target
    expect(reorderIds([1, 2, 3], 1, undefined)).toEqual([1, 2, 3])
  })

  it('fires onReorder with the new id order when the drag end handler runs', () => {
    const onReorder = vi.fn()
    const handleDragEnd = createDragEndHandler([1, 2], onReorder)
    handleDragEnd({ active: { id: 1 }, over: { id: 2 } } as DragEndEvent)
    expect(onReorder).toHaveBeenCalledWith([2, 1])
  })
})
