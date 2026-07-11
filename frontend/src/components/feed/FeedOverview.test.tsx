import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '@/theme'
import { FeedOverview } from './FeedOverview'
import * as api from '@/api'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark"><FeedOverview onSelect={() => {}} /></ThemeProvider></QueryClientProvider>)
}

describe('FeedOverview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getFeed').mockResolvedValue({
      counts: { trending: 3, news: 2, learning: 1, topics: 4 },
      recent: [{ category: 'news', id: 1, title: 'Recent one', when: '2026-07-10T00:00:00', status: 'new', tags: [], links: [] }],
    })
  })
  it('renders KPI counts and the recent stream', async () => {
    wrap()
    expect(await screen.findByText('Recent one')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()   // news count tile
  })
})
