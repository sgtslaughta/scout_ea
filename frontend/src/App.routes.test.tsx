import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from './theme'
import { TimersProvider } from './lib/useTimers'
import { App } from './App'

function renderAt(path: string) {
  // Suppress briefing auto-open: set today's date so App doesn't open modal
  localStorage.setItem('ea-briefing-shown', new Date().toISOString().split('T')[0])

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[path]}>
          <TimersProvider>
            <App />
          </TimersProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('routing', () => {
  it('marks the active route with aria-current', async () => {
    renderAt('/settings')
    const link = await screen.findByRole('link', { name: /settings/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('redirects legacy /deadlines to /schedule', async () => {
    renderAt('/deadlines')
    const link = await screen.findByRole('link', { name: /schedule/i })
    await waitFor(() => expect(link).toHaveAttribute('aria-current', 'page'))
  })

  it('redirects legacy /inbox to the feed inbox section', async () => {
    renderAt('/inbox')
    const link = await screen.findByRole('link', { name: /data feed/i })
    await waitFor(() => expect(link).toHaveAttribute('aria-current', 'page'))
  })

  it('redirects legacy /actions to the feed actions section', async () => {
    renderAt('/actions')
    const link = await screen.findByRole('link', { name: /data feed/i })
    await waitFor(() => expect(link).toHaveAttribute('aria-current', 'page'))
  })

  it('has no Review nav link', async () => {
    renderAt('/')
    await screen.findByRole('link', { name: /data feed/i })
    expect(screen.queryByRole('link', { name: /^review$/i })).toBeNull()
  })
})
