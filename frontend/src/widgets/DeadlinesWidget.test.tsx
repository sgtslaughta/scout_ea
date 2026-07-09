import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '@/api'
import DeadlinesWidget from './DeadlinesWidget'

const rows = [
  { id: 1, title: 'Ship report', due_at: '2026-07-09T18:00:00', countdown_seconds: 3600, source: 'manual', status: 'active', visible: 1 },
  { id: 2, title: 'Renew cert', due_at: '2026-08-01T09:00:00', countdown_seconds: 900000, source: 'manual', status: 'active', visible: 1 },
]

vi.mock('@/api', () => ({
  getDeadlines: vi.fn(async () => rows),
}))

const mockGetDeadlines = vi.mocked(api.getDeadlines)

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('DeadlinesWidget', () => {
  it('renders rows sorted by countdown with formatted countdown', async () => {
    wrap(<DeadlinesWidget />)
    expect(await screen.findByText('Ship report')).toBeInTheDocument()
    expect(screen.getByText('1h 0m')).toBeInTheDocument()
    expect(screen.getByText('Renew cert')).toBeInTheDocument()
  })

  it('shows empty state without rows', async () => {
    mockGetDeadlines.mockResolvedValueOnce([])
    wrap(<DeadlinesWidget />)
    expect(await screen.findByText(/no deadlines/i)).toBeInTheDocument()
  })
})
