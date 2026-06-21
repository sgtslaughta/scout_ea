import { render, screen } from '@testing-library/react'
import { SettingsView } from './Settings'

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
})
