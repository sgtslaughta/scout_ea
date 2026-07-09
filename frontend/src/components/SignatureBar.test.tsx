import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { SignatureBar } from './SignatureBar'

function renderBar() {
  return render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <SignatureBar />
    </ThemeProvider>,
  )
}

describe('SignatureBar', () => {
  it('toggles color mode via useColorScheme', () => {
    localStorage.setItem('ea-theme', 'dark')
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: /switch to light mode/i }))
    expect(localStorage.getItem('ea-theme')).toBe('light')
  })

  it('shows brand and command palette trigger', () => {
    renderBar()
    expect(screen.getByText('SCOUT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open command palette/i })).toBeInTheDocument()
  })
})
