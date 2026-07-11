import { it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '../api'
import { ActionsView } from './Actions'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}>
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
  </QueryClientProvider>)

it('renders a pending-review draft with a Go button', async () => {
  vi.spyOn(api, 'listActions').mockResolvedValue([
    { id: 1, action_type: 'email_new', mode: 'review', status: 'drafted',
      rationale: 'follow up', created_at: '2026-07-11T00:00:00Z' } as api.Action,
  ])
  wrap(<ActionsView />)
  await waitFor(() => expect(screen.getByText('follow up')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /go/i })).toBeInTheDocument()
})
