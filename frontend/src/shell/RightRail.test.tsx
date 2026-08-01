import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { DragEndEvent } from '@dnd-kit/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { RightRail, reorderIds, createDragEndHandler, applyView, toBucket } from './RightRail'
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

  // The cycle follows how work moves: not started -> in progress -> done.
  it.each([
    ['open', /mark as in progress/i, 'in_progress'],
    ['in_progress', /mark as done/i, 'done'],
    ['done', /mark as not started/i, 'open'],
  ] as const)('cycles %s to the next status', async (from, label, to) => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 1, title: 'Write report', status: from, priority: 3, sort: 0 },
    ])
    renderRail()
    fireEvent.click(await screen.findByRole('button', { name: label }))
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith(1, { status: to }))
  })

  it('clicking the bucket glyph cycles priority and PATCHes 2/3/4', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 1, title: 'Write report', status: 'open', priority: 3, sort: 0 },
    ])
    renderRail()
    // priority 3 -> normal bucket -> click sets low (4)
    fireEvent.click(await screen.findByRole('button', { name: /normal priority.*low/i }))
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith(1, { priority: 4 }))
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

  it('shows the grip drag handle in manual sort mode', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 1, title: 'A', status: 'open', priority: 3, sort: 0 },
    ])
    renderRail()
    expect(await screen.findByRole('button', { name: /reorder a/i })).toBeInTheDocument()
  })

  it('hides the grip drag handle when sorted by priority or status', async () => {
    vi.spyOn(api, 'getTasks').mockResolvedValue([
      { id: 1, title: 'A', status: 'open', priority: 3, sort: 0 },
    ])
    renderRail()
    await screen.findByText('A')
    fireEvent.mouseDown(screen.getByLabelText('Sort by'))
    fireEvent.click(await screen.findByRole('option', { name: 'Priority' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /reorder a/i })).not.toBeInTheDocument())
  })
})

describe('toBucket', () => {
  it('maps 1-2 to high, 3 to normal, 4-5 to low', () => {
    expect(toBucket(1)).toBe('high')
    expect(toBucket(2)).toBe('high')
    expect(toBucket(3)).toBe('normal')
    expect(toBucket(4)).toBe('low')
    expect(toBucket(5)).toBe('low')
  })

  it('clamps out-of-range values', () => {
    expect(toBucket(0)).toBe('high')
    expect(toBucket(-5)).toBe('high')
    expect(toBucket(6)).toBe('low')
    expect(toBucket(99)).toBe('low')
  })
})

describe('applyView', () => {
  const tasks = [
    { id: 1, title: 'a', status: 'done' as const, priority: 3 },
    { id: 2, title: 'b', status: 'open' as const, priority: 1 },
    { id: 3, title: 'c', status: 'in_progress' as const, priority: 5 },
  ]

  it('keeps the user\'s own order by default (manual)', () => {
    expect(applyView(tasks, { hideDone: false, sort: 'manual', onlyHigh: false }).map((t) => t.id))
      .toEqual([1, 2, 3])
  })

  it('hides done tasks when asked', () => {
    expect(applyView(tasks, { hideDone: true, sort: 'manual', onlyHigh: false }).map((t) => t.id))
      .toEqual([2, 3])
  })

  it('sorts ascending by raw priority number', () => {
    expect(applyView(tasks, { hideDone: false, sort: 'priority', onlyHigh: false }).map((t) => t.id))
      .toEqual([2, 1, 3])
  })

  it('sorts in progress first, then not started, then done (status)', () => {
    expect(applyView(tasks, { hideDone: false, sort: 'status', onlyHigh: false }).map((t) => t.id))
      .toEqual([3, 2, 1])
  })

  it('filters to high-priority tasks only', () => {
    expect(applyView(tasks, { hideDone: false, sort: 'manual', onlyHigh: true }).map((t) => t.id))
      .toEqual([2])
  })

  it('combines hideDone, onlyHigh, and a sort mode', () => {
    const withHigh = [
      { id: 1, title: 'a', status: 'done' as const, priority: 1 },
      { id: 2, title: 'b', status: 'open' as const, priority: 2 },
      { id: 3, title: 'c', status: 'in_progress' as const, priority: 1 },
    ]
    expect(applyView(withHigh, { hideDone: true, sort: 'status', onlyHigh: true }).map((t) => t.id))
      .toEqual([3, 2])
  })

  it('does not mutate the input when sorting by priority', () => {
    const before = tasks.map((t) => t.id)
    applyView(tasks, { hideDone: false, sort: 'priority', onlyHigh: false })
    expect(tasks.map((t) => t.id)).toEqual(before)
  })

  it('does not mutate the input when sorting by status', () => {
    const before = tasks.map((t) => t.id)
    applyView(tasks, { hideDone: false, sort: 'status', onlyHigh: false })
    expect(tasks.map((t) => t.id)).toEqual(before)
  })
})
