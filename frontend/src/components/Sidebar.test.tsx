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
  it('hides text labels when collapsed but keeps accessible links', () => {
    wrap(true)
    expect(screen.queryByText('Home')).toBeNull()
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
  })

  it('shows the 7 registry labels and group headers when expanded', () => {
    wrap(false)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toBeInTheDocument()
    expect(screen.getByText('Knowledge')).toBeInTheDocument()
  })

  it('toggle button calls onToggle with negated value', () => {
    const onToggle = vi.fn()
    wrap(false, onToggle)
    fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})
