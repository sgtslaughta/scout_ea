import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '@/api'
import TrendingWidget from './TrendingWidget'

const rows = [
  { id: 1, term: 'AI Strategy', kind: 'topic', window_start: '', window_end: '', score: 85, delta: 8 },
  { id: 2, term: 'Vendor Risk', kind: 'topic', window_start: '', window_end: '', score: 45, delta: -3 },
]

vi.mock('@/api', () => ({
  getTrends: vi.fn(async () => rows),
}))

const mockGetTrends = vi.mocked(api.getTrends)

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

describe('TrendingWidget', () => {
  it('lists terms with delta chips', async () => {
    wrap(<TrendingWidget />)
    expect(await screen.findByText('+8%')).toBeInTheDocument()
    expect(screen.getByText('-3%')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    mockGetTrends.mockResolvedValueOnce([])
    wrap(<TrendingWidget />)
    expect(await screen.findByText(/no trends/i)).toBeInTheDocument()
  })
})
