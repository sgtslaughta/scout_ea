import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import * as api from '@/api'
import { InboxView } from './Inbox'

afterEach(() => vi.restoreAllMocks())

const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        {ui}
      </ThemeProvider>
    </MemoryRouter>
  </QueryClientProvider>
)

describe('Inbox signal actions', () => {
  it('each inbox signal exposes an Actions menu', async () => {
    vi.spyOn(api, 'getSignals').mockResolvedValue([
      {
        id: 42,
        type: 'email',
        source: 'x',
        title: 'Budget?',
        status: 'new',
        priority: 1,
        created_at: '2025-01-01T00:00:00Z',
      } as api.Signal,
    ])
    vi.spyOn(api, 'listActions').mockResolvedValue([])

    wrap(<InboxView />)

    await waitFor(() => expect(screen.getByText('Budget?')).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: /actions/i }).length).toBeGreaterThan(0)
  })
})
