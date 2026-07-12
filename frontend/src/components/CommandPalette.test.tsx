import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPalette } from './CommandPalette'
import * as api from '@/api'

const onOpenChange = vi.fn()
const onViewChange = vi.fn()
const onRefresh = vi.fn()

function renderPalette(open = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CommandPalette open={open} onOpenChange={onOpenChange} onViewChange={onViewChange} onRefresh={onRefresh} />
    </QueryClientProvider>,
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    onOpenChange.mockClear(); onViewChange.mockClear(); onRefresh.mockClear()
    vi.spyOn(api, 'search').mockResolvedValue([])
  })

  it('does not render when closed', () => {
    renderPalette(false)
    expect(screen.queryByPlaceholderText(/search everything/i)).not.toBeInTheDocument()
  })

  it('renders input, nav and quick actions when open', () => {
    renderPalette()
    expect(screen.getByPlaceholderText(/search everything/i)).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Data Feed')).toBeInTheDocument()
    expect(screen.getByText('Add deadline')).toBeInTheDocument()
    expect(screen.getByText('Refresh data')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderPalette()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('navigates when selecting a view', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Home'))
    expect(onViewChange).toHaveBeenCalledWith('/')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('navigates to a registry path when a nav item is chosen', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Data Feed'))
    expect(onViewChange).toHaveBeenCalledWith('/feed')
  })

  it('calls onRefresh from the refresh action', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Refresh data'))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('filters nav items by typed text', () => {
    renderPalette()
    fireEvent.change(screen.getByPlaceholderText(/search everything/i), { target: { value: 'feed' } })
    expect(screen.getByText('Data Feed')).toBeInTheDocument()
    expect(screen.queryByText('People')).not.toBeInTheDocument()
  })

  it('shows live search results and navigates to the mapped view', async () => {
    vi.spyOn(api, 'search').mockResolvedValue([
      { kind: 'task', ref_id: 5, title: 'Budget review', snippet: 'Q3 [budget]' },
    ])
    renderPalette()
    fireEvent.change(screen.getByPlaceholderText(/search everything/i), { target: { value: 'budget' } })
    const result = await screen.findByText('Budget review')
    fireEvent.click(result)
    expect(onViewChange).toHaveBeenCalledWith('/tasks') // task -> /tasks
  })
})
