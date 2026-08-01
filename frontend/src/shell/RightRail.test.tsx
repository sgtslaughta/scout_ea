import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DragEndEvent } from '@dnd-kit/core'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { RightRail, reorderIds, createDragEndHandler } from './RightRail'
import type { RailTask } from './RightRail'

function renderRail(props: Partial<React.ComponentProps<typeof RightRail>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <RightRail {...props} />
    </ThemeProvider>
  )
}

const tasks: RailTask[] = [
  { id: 1, title: 'Write report', status: 'open' },
  { id: 2, title: 'Review PR', status: 'in_progress' },
]

describe('RightRail', () => {
  it('renders the To do heading', () => {
    renderRail()
    expect(screen.getByRole('heading', { name: 'To do' })).toBeInTheDocument()
  })

  it('shows a friendly empty state when there are no tasks', () => {
    renderRail()
    expect(screen.getByText('Nothing to do yet. Add your first task.')).toBeInTheDocument()
  })

  it('renders a row per task when given tasks', () => {
    renderRail({ tasks })
    expect(screen.getByText('Write report')).toBeInTheDocument()
    expect(screen.getByText('Review PR')).toBeInTheDocument()
  })

  it('cycles the status box open -> done and fires onStatusChange with the next value', () => {
    const onStatusChange = vi.fn()
    renderRail({ tasks: [{ id: 1, title: 'Write report', status: 'open' }], onStatusChange })

    fireEvent.click(screen.getByRole('button', { name: /mark as done/i }))
    expect(onStatusChange).toHaveBeenCalledWith(1, 'done')
  })

  it('gives the status box a natural-language accessible name reflecting each state', () => {
    renderRail({
      tasks: [
        { id: 1, title: 'A', status: 'open' },
        { id: 2, title: 'B', status: 'done' },
        { id: 3, title: 'C', status: 'in_progress' },
      ],
    })
    expect(screen.getByRole('button', { name: /mark as done/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /done.*mark as in progress/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /in progress.*mark as open/i })).toBeInTheDocument()
  })

  it('exposes a keyboard-focusable drag handle with sortable aria attributes', () => {
    renderRail({ tasks })
    const handle = screen.getAllByRole('button', { name: /reorder/i })[0]
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable')
    expect(handle).toHaveAttribute('tabindex', '0')
  })

  it('reorderIds maps a drag end to the new id order', () => {
    expect(reorderIds([1, 2, 3], 1, 3)).toEqual([2, 3, 1])
    expect(reorderIds([1, 2, 3], 3, 1)).toEqual([3, 1, 2])
    // no-op when dropped without a valid target
    expect(reorderIds([1, 2, 3], 1, undefined)).toEqual([1, 2, 3])
  })

  it('fires onReorder with the new id order when the drag end handler runs', () => {
    const onReorder = vi.fn()
    // This is exactly the handler RightRail passes to DndContext's onDragEnd —
    // firing it directly is the reliable way to test dnd-kit reordering in jsdom.
    const handleDragEnd = createDragEndHandler([1, 2], onReorder)
    handleDragEnd({ active: { id: 1 }, over: { id: 2 } } as DragEndEvent)
    expect(onReorder).toHaveBeenCalledWith([2, 1])
  })
})
