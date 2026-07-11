import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { Bell } from 'lucide-react'
import { theme } from '../../theme'
import { QuickdrawItem } from './QuickdrawItem'

function renderItem(props: Partial<Parameters<typeof QuickdrawItem>[0]> = {}) {
  const actions = props.actions ?? [{ label: 'Silence', icon: <Bell size={14} />, onClick: vi.fn() }]
  render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <QuickdrawItem glyph={<Bell size={14} />} title="Budget question" meta="45m" actions={actions} expanded={false} {...props} />
    </ThemeProvider>,
  )
  return actions
}

describe('QuickdrawItem', () => {
  it('collapsed: actions hidden behind a ⋯ menu', () => {
    const actions = renderItem({ expanded: false })
    expect(screen.queryByRole('button', { name: 'Silence' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Silence' }))
    expect(actions[0].onClick).toHaveBeenCalledOnce()
  })

  it('expanded: action buttons render inline', () => {
    const actions = renderItem({ expanded: true })
    fireEvent.click(screen.getByRole('button', { name: 'Silence' }))
    expect(actions[0].onClick).toHaveBeenCalledOnce()
  })

  it('destructive action asks for confirmation before firing', () => {
    const onClick = vi.fn()
    renderItem({ expanded: true, actions: [{ label: 'Dismiss', icon: <Bell size={14} />, onClick, destructive: true }] })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('row body click calls onOpen', () => {
    const onOpen = vi.fn()
    renderItem({ onOpen })
    fireEvent.click(screen.getByText('Budget question'))
    expect(onOpen).toHaveBeenCalledOnce()
  })
})
