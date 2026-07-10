import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from './CommandPalette'

describe('CommandPalette', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnViewChange = vi.fn()
  const mockOnRefresh = vi.fn()

  beforeEach(() => {
    mockOnOpenChange.mockClear()
    mockOnViewChange.mockClear()
    mockOnRefresh.mockClear()
  })

  it('does not render when open is false', () => {
    render(
      <CommandPalette
        open={false}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('renders search input when open', () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    const input = screen.getByPlaceholderText('Search...')
    expect(input).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('updates search value on input change', () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'today' } })
    expect(input.value).toBe('today')
  })

  it('closes on backdrop click', () => {
    const { container } = render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    // Find the outer wrapper div (backdrop)
    const backdrop = container.querySelector('div')
    if (backdrop && backdrop.parentElement === container) {
      fireEvent.click(backdrop)
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    }
  })

  it('renders navigation views', () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Inbox')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('Calendar')).toBeInTheDocument()
  })

  it('calls onViewChange when selecting a view', () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    const todayItem = screen.getByText('Today')
    fireEvent.click(todayItem)
    expect(mockOnViewChange).toHaveBeenCalledWith('today')
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders quick actions', () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    expect(screen.getByText('Add deadline')).toBeInTheDocument()
    expect(screen.getByText('Refresh data')).toBeInTheDocument()
  })

  it('calls onRefresh when selecting refresh action', () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    const refreshItem = screen.getByText('Refresh data')
    fireEvent.click(refreshItem)
    expect(mockOnRefresh).toHaveBeenCalled()
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('has no Tailwind classNames', () => {
    const { container } = render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onViewChange={mockOnViewChange}
        onRefresh={mockOnRefresh}
      />
    )
    // Check that no elements have Tailwind class names (which have specific patterns like "bg-", "text-", "px-", "py-", "rounded-", etc.)
    const allElements = container.querySelectorAll('[class]')
    const withTailwind = Array.from(allElements).filter((el) => {
      const cls = (el as HTMLElement).className
      // Match Tailwind patterns: bg-X, text-X, px-X, py-X, rounded-X, shadow-X, border-X, etc.
      return /\b(bg|text|px|py|rounded|shadow|border|inset|pt|flex|items|justify|z|fixed|w|h|max-h|overflow|cursor|transition|hover|focus|outline|pb|pl|pr)\-/.test(
        cls
      )
    })
    expect(withTailwind.length).toBe(0)
  })
})
