import { it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import * as api from '../../api'
import { ActionBadge } from './ActionBadge'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter>
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
  </MemoryRouter></QueryClientProvider>)

it('shows "draft ready" when the entity has a drafted action', async () => {
  vi.spyOn(api, 'listActions').mockResolvedValue([
    { id: 1, entity_type: 'email', entity_id: 5, action_type: 'email_reply',
      mode: 'review', status: 'drafted', created_at: 'x' } as api.Action,
  ])
  wrap(<ActionBadge entityType="email" entityId={5} />)
  await waitFor(() => expect(screen.getByText(/draft ready/i)).toBeInTheDocument())
})
