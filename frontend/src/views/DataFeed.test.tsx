import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '@/theme'
import { DataFeedView } from './DataFeed'
import * as api from '@/api'

function wrap(initialEntry = '/feed') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark">
      <MemoryRouter initialEntries={[initialEntry]}><DataFeedView /></MemoryRouter>
    </ThemeProvider></QueryClientProvider>,
  )
}

describe('DataFeed shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getFeed').mockResolvedValue({ counts: { trending: 0, news: 0, learning: 0, topics: 0 }, recent: [] })
    vi.spyOn(api, 'getNews').mockResolvedValue([])
    vi.spyOn(api, 'getLearning').mockResolvedValue([])
    vi.spyOn(api, 'getTrends').mockResolvedValue([])
    vi.spyOn(api, 'getTopics').mockResolvedValue([])
  })
  it('starts on overview and switches view via the rail', async () => {
    wrap()
    expect(await screen.findByText('Overview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^news$/i }))
    // context bar title updates to News
    expect(screen.getAllByText('News').length).toBeGreaterThan(0)
  })
  it('honours ?view=trending on mount', async () => {
    wrap('/feed?view=trending')
    // rail marks Trending active (aria-current)
    expect(screen.getByRole('button', { name: /trending/i })).toHaveAttribute('aria-current', 'true')
  })
})
