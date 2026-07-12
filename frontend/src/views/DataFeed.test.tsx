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
    // rail marks Overview active on first render
    await screen.findByRole('button', { name: /overview/i })
    expect(screen.getByRole('button', { name: /overview/i })).toHaveAttribute('aria-current', 'true')
    // click the News rail entry → News becomes the active view
    fireEvent.click(screen.getByRole('button', { name: /^news$/i }))
    expect(screen.getByRole('button', { name: /^news$/i })).toHaveAttribute('aria-current', 'true')
  })
  it('honours ?view=trending on mount', async () => {
    wrap('/feed?view=trending')
    // rail marks Trending active (aria-current)
    expect(screen.getByRole('button', { name: /trending/i })).toHaveAttribute('aria-current', 'true')
  })
  it('overview trending item opens detail with no status action (correct category)', async () => {
    vi.spyOn(api, 'getContentRefs').mockResolvedValue([])
    vi.spyOn(api, 'getTags').mockResolvedValue([])
    vi.spyOn(api, 'getPeople').mockResolvedValue([])
    vi.spyOn(api, 'getTopics').mockResolvedValue([])
    vi.spyOn(api, 'getFeed').mockResolvedValue({
      counts: { trending: 1, news: 0, learning: 0, topics: 0 },
      recent: [{ category: 'trending', id: 8, title: 'Trend X', when: '2026-07-10T00:00:00', status: '', tags: [], links: [] }],
    })
    wrap()
    fireEvent.click(await screen.findByText('Trend X'))
    expect(screen.queryByRole('button', { name: /mark read/i })).toBeNull()
  })
  it('renders the Inbox section when view=inbox', async () => {
    vi.spyOn(api, 'getSignals').mockResolvedValue([
      { id: 1, type: 'email', source: 'inbox', title: 'A signal', status: 'new', priority: 1, created_at: '2026-07-12T09:00:00Z' },
    ] as never)
    wrap('/feed?view=inbox')
    expect(await screen.findByText('A signal')).toBeInTheDocument()
  })
})
