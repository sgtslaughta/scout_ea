import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import KpiStrip, { dailyCounts } from './KpiStrip'

const outlook = {
  date: '2026-07-09',
  deadlines: [],
  top_trends: [],
  proactive: [{ id: 1, type: 'proactive', source: 's', title: 'p', status: 'new', priority: 2, created_at: '2026-07-09T10:00:00' }],
  tasks_due_today: [],
}

vi.mock('@/api', () => ({
  getOutlook: vi.fn(async () => outlook),
  getDeadlines: vi.fn(async () => []),
  getTrends: vi.fn(async () => []),
  getSignals: vi.fn(async () => []),
  getActivity: vi.fn(async () => []),
}))

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

describe('KpiStrip', () => {
  it('renders all six tiles with values', async () => {
    wrap(<KpiStrip />)
    expect(await screen.findByText('Proactive')).toBeInTheDocument()
    for (const label of ['Due Today', 'Urgent (<24h)', 'Rising', 'Signals', 'Skill Runs']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(await screen.findByText('1')).toBeInTheDocument() // proactive count
  })

  it('clickable tiles are links to filtered views', async () => {
    wrap(<KpiStrip />)
    const tile = await screen.findByRole('link', { name: /proactive/i })
    expect(tile).toHaveAttribute('href', '/feed?view=inbox&type=proactive')
  })
})

describe('dailyCounts', () => {
  it('buckets timestamps into trailing days, oldest first', () => {
    const today = new Date('2026-07-09T12:00:00')
    const counts = dailyCounts(
      ['2026-07-09T01:00:00', '2026-07-09T23:00:00', '2026-07-07T09:00:00', '2026-06-01T00:00:00'],
      3,
      today,
    )
    expect(counts).toEqual([1, 0, 2])
  })
})
