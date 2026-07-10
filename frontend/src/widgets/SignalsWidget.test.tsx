import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '@/api'
import SignalsWidget from './SignalsWidget'

const signals = [
  { id: 1, title: 'Urgent signal', type: 'email', priority: 1, status: 'new', source: 'test', source_skill: null, created_at: new Date().toISOString() },
  { id: 2, title: 'Proactive signal', type: 'proactive', priority: 2, status: 'new', source: 'test', source_skill: null, created_at: new Date().toISOString() },
]

vi.mock('@/api', () => ({
  getSignals: vi.fn(async () => signals),
}))

const mockGetSignals = vi.mocked(api.getSignals)

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

describe('SignalsWidget', () => {
  it('renders non-proactive rows and filters out proactive', async () => {
    wrap(<SignalsWidget />)
    expect(await screen.findByText('Urgent signal')).toBeInTheDocument()
    expect(screen.queryByText('Proactive signal')).not.toBeInTheDocument()
  })

  it('shows empty state without rows', async () => {
    mockGetSignals.mockResolvedValueOnce([])
    wrap(<SignalsWidget />)
    expect(await screen.findByText(/no new signals/i)).toBeInTheDocument()
  })
})
