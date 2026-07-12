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

it('blocks javascript: URLs in result.access_url and renders safe https URLs', async () => {
  vi.spyOn(api, 'listActions').mockResolvedValue([
    { id: 1, action_type: 'email_new', status: 'completed',
      result: { access_url: 'javascript:alert(1)' }, created_at: '2026-07-11T00:00:00Z' } as unknown as api.Action,
    { id: 2, action_type: 'send_message', status: 'completed',
      result: { access_url: 'https://example.com/path' }, created_at: '2026-07-11T00:00:00Z' } as unknown as api.Action,
  ])
  wrap(<ActionsView />)
  await waitFor(() => {
    const link = screen.getByRole('link', { name: /open/i })
    expect(link).toHaveAttribute('href', 'https://example.com/path')
  })
  expect(screen.getAllByRole('link', { name: /open/i }).length).toBe(1)
  const link = screen.getByRole('link', { name: /open/i })
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})
