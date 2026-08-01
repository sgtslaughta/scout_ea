import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickLinkTile } from './QuickLinkTile'

beforeEach(() => vi.restoreAllMocks())

describe('QuickLinkTile', () => {
  it('renders the friendly name', () => {
    render(<QuickLinkTile link={{ name: 'Docs', url: 'https://example.com/docs' }} />)
    expect(screen.getByText('Docs')).toBeInTheDocument()
  })

  it('opens the url in a new tab on click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<QuickLinkTile link={{ name: 'Docs', url: 'https://example.com/docs' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Docs' }))
    expect(openSpy).toHaveBeenCalledWith('https://example.com/docs', '_blank', 'noopener')
  })

  it('is keyboard accessible (opens on Enter)', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<QuickLinkTile link={{ name: 'Docs', url: 'https://example.com/docs' }} />)
    const tile = screen.getByRole('button', { name: 'Docs' })
    tile.focus()
    await userEvent.keyboard('{Enter}')
    expect(openSpy).toHaveBeenCalledWith('https://example.com/docs', '_blank', 'noopener')
  })
})
