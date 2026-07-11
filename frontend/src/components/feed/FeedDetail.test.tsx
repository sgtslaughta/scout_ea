import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '@/theme'
import { FeedDetail } from './FeedDetail'
import * as api from '@/api'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark">{ui}</ThemeProvider></QueryClientProvider>)
}

describe('FeedDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getContentRefs').mockResolvedValue({ tags: [], links: [] })
    vi.spyOn(api, 'getTags').mockResolvedValue([])
    vi.spyOn(api, 'getPeople').mockResolvedValue([])
    vi.spyOn(api, 'getTopics').mockResolvedValue([])
  })
  it('renders null with no selection', () => {
    const { container } = wrap(<FeedDetail selection={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
  it('shows title + a status action for news; hides status for trending', () => {
    const setNews = vi.spyOn(api, 'setNewsStatus').mockResolvedValue({ updated: 1 })
    wrap(<FeedDetail selection={{ category: 'news', id: 5, item: { id: 5, title: 'N', status: 'new' } as api.NewsItem }} onClose={() => {}} />)
    expect(screen.getByText('N')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mark read/i }))
    expect(setNews).toHaveBeenCalledWith(5, 'read')
  })
  it('no status actions for a trending item', () => {
    wrap(<FeedDetail selection={{ category: 'trending', id: 8, item: { category: 'trending', id: 8, title: 'T', when: '', status: '' } as api.FeedRecent }} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /mark read/i })).toBeNull()
  })
})
