import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { SettingsView } from './Settings'

function renderSettings() {
  return render(
    <ThemeProvider theme={theme} defaultMode="system" modeStorageKey="ea-theme">
      <SettingsView />
    </ThemeProvider>,
  )
}

// ponytail: render-only test for Settings heading
describe('Settings view', () => {
  it('renders Settings header', () => {
    render(<SettingsView />)
    const heading = screen.getByText('Settings')
    if (!heading) throw new Error('Settings header not found')
  })

  it('renders accent color picker', () => {
    render(<SettingsView />)
    const label = screen.getByText('Accent Color')
    if (!label) throw new Error('Accent Color label not found')
  })

  it('wires theme mode selection to ea-theme localStorage', () => {
    localStorage.setItem('ea-theme', 'dark')
    renderSettings()
    const lightButton = screen.getByRole('button', { name: 'Light' })
    fireEvent.click(lightButton)
    expect(localStorage.getItem('ea-theme')).toBe('light')
  })
})
