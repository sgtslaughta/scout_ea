import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

function wrap(collapsed: boolean, onToggle = vi.fn()) {
  return render(
    <MemoryRouter>
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  it('hides text labels when collapsed', () => {
    wrap(true)
    // icons present as accessible links, but the visible "Dashboard" text label is not rendered
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('shows text labels when expanded', () => {
    wrap(false)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('toggle button calls onToggle with negated value', () => {
    const onToggle = vi.fn()
    wrap(false, onToggle)
    fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})
