import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from './theme'
import { App } from './App'

function renderAt(path: string) {
  // Suppress briefing auto-open: set today's date so App doesn't open modal
  localStorage.setItem('ea-briefing-shown', new Date().toISOString().split('T')[0])

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('routing', () => {
  it('renders grouped sidebar nav links from the registry', async () => {
    renderAt('/')
    const link = await screen.findByRole('link', { name: /review/i })
    expect(link).toHaveAttribute('href', '/review')
  })

  it('marks the active route with aria-current', async () => {
    renderAt('/settings')
    const link = await screen.findByRole('link', { name: /settings/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('redirects legacy /inbox to /review', async () => {
    renderAt('/inbox')
    const link = await screen.findByRole('link', { name: /review/i })
    await waitFor(() => expect(link).toHaveAttribute('aria-current', 'page'))
  })

  it('redirects legacy /deadlines to /schedule', async () => {
    renderAt('/deadlines')
    const link = await screen.findByRole('link', { name: /schedule/i })
    await waitFor(() => expect(link).toHaveAttribute('aria-current', 'page'))
  })
})
