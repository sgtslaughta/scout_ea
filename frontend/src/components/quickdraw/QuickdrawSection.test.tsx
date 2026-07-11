import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { QuickdrawSection } from './QuickdrawSection'

function renderSection(props: Partial<Parameters<typeof QuickdrawSection>[0]> = {}) {
  const onToggle = props.onToggle ?? vi.fn()
  render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <QuickdrawSection id="needs" label="Needs Response" count={0} collapsed={false} onToggle={onToggle} empty="Holstered — nothing to draw." {...props}>
        <div>child-row</div>
      </QuickdrawSection>
    </ThemeProvider>,
  )
  return onToggle
}

describe('QuickdrawSection', () => {
  it('shows empty micro-copy when count is 0', () => {
    renderSection({ count: 0 })
    expect(screen.getByText('Holstered — nothing to draw.')).toBeInTheDocument()
    expect(screen.queryByText('child-row')).toBeNull()
  })

  it('renders children when count > 0', () => {
    renderSection({ count: 2 })
    expect(screen.getByText('child-row')).toBeInTheDocument()
  })

  it('header click toggles', () => {
    const onToggle = renderSection()
    fireEvent.click(screen.getByRole('button', { name: /needs response/i }))
    expect(onToggle).toHaveBeenCalledWith('needs')
  })

  it('collapsed hides body', () => {
    renderSection({ collapsed: true, count: 2 })
    expect(screen.queryByText('child-row')).toBeNull()
  })
})
