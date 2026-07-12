import { it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { ActionMenu } from './ActionMenu'

const wrap = (ui: React.ReactNode) =>
  render(<ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>)

it('opens a menu listing the entity actions', () => {
  wrap(<ActionMenu entity={{ type: 'email', id: 1 }} />)
  fireEvent.click(screen.getByRole('button', { name: /actions/i }))
  expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Forward' })).toBeInTheDocument()
})
