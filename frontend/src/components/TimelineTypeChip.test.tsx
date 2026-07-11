import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { TimelineTypeChip } from './TimelineTypeChip'

function renderChip(type: 'deadline' | 'task' | 'event') {
  return render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <TimelineTypeChip type={type} />
    </ThemeProvider>,
  )
}

describe('TimelineTypeChip', () => {
  it('renders the type label', () => {
    renderChip('deadline')
    expect(screen.getByText('Deadline')).toBeInTheDocument()
  })

  it('labels each type distinctly with its accessible name', () => {
    const { rerender } = renderChip('task')
    expect(screen.getByLabelText('Task')).toBeInTheDocument()
    rerender(
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        <TimelineTypeChip type="event" />
      </ThemeProvider>,
    )
    expect(screen.getByLabelText('Event')).toBeInTheDocument()
  })

  it('uses the type semantic hue (deadline → error)', () => {
    renderChip('deadline')
    const chip = screen.getByLabelText('Deadline')
    // error.main resolves to a themed color; the chip text color must be set, not default.
    expect(chip).toHaveStyle({ textTransform: 'uppercase' })
    expect(chip.getAttribute('aria-label')).toBe('Deadline')
  })
})
