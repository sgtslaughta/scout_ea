import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelpDialog } from './HelpDialog'

function wrap(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <HelpDialog open={open} onClose={onClose} />
    </MemoryRouter>,
  )
}

describe('HelpDialog', () => {
  it('does not render content when closed', () => {
    wrap(false)
    expect(screen.queryByText(/keyboard shortcuts/i)).toBeNull()
  })

  it('shows shortcuts and a skills link when open', () => {
    wrap(true)
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument()
    expect(screen.getByText('⌘K')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /skills library/i })).toHaveAttribute('href', '/skills')
  })

  it('calls onClose from the Close button', () => {
    const onClose = vi.fn()
    wrap(true, onClose)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
