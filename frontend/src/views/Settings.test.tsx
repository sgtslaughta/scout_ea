import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { SettingsView } from './Settings'

function renderSettings() {
  return render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <SettingsView />
    </ThemeProvider>,
  )
}

describe('Settings view', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders Settings header', () => {
    render(<SettingsView />)
    const heading = screen.getByText('Settings')
    expect(heading).toBeDefined()
  })

  it('renders accent color picker', () => {
    render(<SettingsView />)
    const label = screen.getByText('Accent Color')
    expect(label).toBeDefined()
  })

  it('wires theme mode selection to ea-theme localStorage', () => {
    localStorage.setItem('ea-theme', 'dark')
    renderSettings()
    const lightButton = screen.getByRole('button', { name: /light/i })
    fireEvent.click(lightButton)
    expect(localStorage.getItem('ea-theme')).toBe('light')
  })
})
