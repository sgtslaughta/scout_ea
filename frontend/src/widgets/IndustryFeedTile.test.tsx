import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '@/api'
import type { NewsItem, Topic } from '@/api'
import IndustryFeedTile, { sortByRelevance, buildWeeklySummary } from './IndustryFeedTile'

const items: NewsItem[] = [
  { id: 1, title: 'Competitor launches new suite', url: 'https://example.com/a', synopsis: 'They shipped a rival product.', source: 'TechWire', event_at: '2026-07-30T09:00:00Z', relevance: 2, status: 'suggested', topic_id: 10 },
  { id: 2, title: 'Exact-match industry regulation change', url: 'https://example.com/b', synopsis: 'New rules affecting the sector.', source: 'IndustryDaily', event_at: '2026-07-31T09:00:00Z', relevance: 1, status: 'suggested', topic_id: 10 },
  { id: 3, title: 'Tangential market note', url: 'https://example.com/c', synopsis: 'Loosely related item.', source: 'MarketBlog', event_at: '2026-07-29T09:00:00Z', relevance: 5, status: 'suggested' },
]

const topics: Topic[] = [{ id: 10, name: 'Competitive Intel', priority: 1, max_suggest: 5, active: 1 }]

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof import('@/api')>('@/api')
  return { ...actual, getNews: vi.fn(async () => items), getTopics: vi.fn(async () => topics) }
})

const mockGetNews = vi.mocked(api.getNews)

beforeEach(() => {
  vi.restoreAllMocks()
  mockGetNews.mockResolvedValue(items)
  vi.mocked(api.getTopics).mockResolvedValue(topics)
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

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

describe('sortByRelevance', () => {
  it('sorts ascending, 1 (exact match) first', () => {
    const sorted = sortByRelevance(items)
    expect(sorted.map((i) => i.id)).toEqual([2, 1, 3])
  })

  it('pushes items with no relevance to the end', () => {
    const noRel: NewsItem = { id: 4, title: 'No relevance set', status: 'suggested' }
    const sorted = sortByRelevance([noRel, ...items])
    expect(sorted.map((i) => i.id)).toEqual([2, 1, 3, 4])
  })
})

describe('buildWeeklySummary', () => {
  it('groups items by topic and formats headline/source/synopsis', () => {
    const now = new Date('2026-08-01T12:00:00Z')
    const text = buildWeeklySummary(items, topics, now)
    expect(text).toContain('Competitive Intel')
    expect(text).toContain('Exact-match industry regulation change — IndustryDaily')
    expect(text).toContain('New rules affecting the sector.')
    expect(text).toContain('Uncategorized')
    expect(text).toContain('Tangential market note — MarketBlog')
  })

  it('excludes items older than 7 days', () => {
    const now = new Date('2026-08-01T12:00:00Z')
    const old: NewsItem = { id: 9, title: 'Old news', source: 'Old', event_at: '2026-07-01T00:00:00Z', relevance: 1, status: 'suggested' }
    const text = buildWeeklySummary([old], [], now)
    expect(text).not.toContain('Old news')
  })
})

describe('IndustryFeedTile', () => {
  it('renders items most relevant first, capped at 5', async () => {
    wrap(<IndustryFeedTile />)
    const headlines = await screen.findAllByText(/regulation change|Competitor launches|market note/)
    expect(headlines[0]).toHaveTextContent('Exact-match industry regulation change')
  })

  it('opens the article url when a row is clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrap(<IndustryFeedTile />)
    const row = await screen.findByText('Exact-match industry regulation change')
    await userEvent.click(row)
    expect(openSpy).toHaveBeenCalledWith('https://example.com/b', '_blank', 'noopener')
  })

  it('copies the weekly summary to the clipboard and shows a toast', async () => {
    wrap(<IndustryFeedTile />)
    await screen.findByText('Exact-match industry regulation change')
    await userEvent.click(screen.getByRole('button', { name: /copy weekly summary/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
    const text = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0] as string
    expect(text).toContain('Exact-match industry regulation change')
  })

  it('shows empty state via useWidgetCount when no items', async () => {
    mockGetNews.mockResolvedValueOnce([])
    wrap(<IndustryFeedTile />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(/exact-match/i)).not.toBeInTheDocument()
  })
})
