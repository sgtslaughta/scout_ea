import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { LeftRail } from './LeftRail'

function renderRail() {
  return render(
    <ThemeProvider theme={theme}>
      <LeftRail />
    </ThemeProvider>
  )
}

describe('LeftRail', () => {
  it('renders the Calendar heading', () => {
    renderRail()
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument()
  })

  it('shows a friendly empty state when there are no meetings', () => {
    renderRail()
    expect(screen.getByText('Nothing on the calendar today.')).toBeInTheDocument()
  })
})
