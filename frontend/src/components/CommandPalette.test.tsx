import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from './CommandPalette'

const onOpenChange = vi.fn()
const onOpenDrawer = vi.fn()
const onRefresh = vi.fn()

const links = [
  { name: 'THS', url: 'https://ths.example.com' },
  { name: 'MSX Hub', url: 'https://msx.example.com' },
]

vi.mock('@/shell/useQuickLinks', () => ({
  useQuickLinks: () => ({ links, addLink: vi.fn(), editLink: vi.fn(), removeLink: vi.fn() }),
}))

function renderPalette(open = true) {
  return render(
    <CommandPalette open={open} onOpenChange={onOpenChange} onOpenDrawer={onOpenDrawer} onRefresh={onRefresh} />,
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    onOpenChange.mockClear(); onOpenDrawer.mockClear(); onRefresh.mockClear()
  })

  it('does not render when closed', () => {
    renderPalette(false)
    expect(screen.queryByPlaceholderText(/search everything/i)).not.toBeInTheDocument()
  })

  it('renders input, drawer entries, quick links, and refresh action when open', () => {
    renderPalette()
    expect(screen.getByPlaceholderText(/search everything/i)).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.getByText('THS')).toBeInTheDocument()
    expect(screen.getByText('MSX Hub')).toBeInTheDocument()
    expect(screen.getByText('Refresh data')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderPalette()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens the matching drawer when a drawer entry is selected', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Settings'))
    expect(onOpenDrawer).toHaveBeenCalledWith('settings')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens a quick link url when one is selected', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPalette()
    fireEvent.click(screen.getByText('THS'))
    expect(openSpy).toHaveBeenCalledWith('https://ths.example.com/', '_blank', 'noopener')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onRefresh from the refresh action', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Refresh data'))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('filters drawer entries and quick links by typed text', () => {
    renderPalette()
    fireEvent.change(screen.getByPlaceholderText(/search everything/i), { target: { value: 'th' } })
    expect(screen.getByText('THS')).toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    expect(screen.queryByText('MSX Hub')).not.toBeInTheDocument()
  })
})
