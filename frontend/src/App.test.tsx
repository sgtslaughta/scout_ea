import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const useAlertChime = vi.fn()
vi.mock('@/lib/useAlertChime', () => ({ useAlertChime: () => useAlertChime() }))
vi.mock('@/shell/ShellLayout', () => ({ ShellLayout: () => <div>SHELL LAYOUT</div> }))

import { App } from './App'

it('renders the shell and starts the alert chime', () => {
  render(<App />)
  expect(screen.getByText('SHELL LAYOUT')).toBeInTheDocument()
  expect(useAlertChime).toHaveBeenCalled()
})
