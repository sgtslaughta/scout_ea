import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '@/theme'
import { FeedList } from './FeedList'
import * as api from '@/api'

function wrap(kind: 'news' | 'learning') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark"><FeedList kind={kind} onSelect={() => {}} /></ThemeProvider></QueryClientProvider>)
}

describe('FeedList', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getNews').mockResolvedValue([
      { id: 1, title: 'News row', status: 'new', tags: [], links: [] },
    ])
  })
  it('lists news rows and toggles the external origin filter', async () => {
    wrap('news')
    expect(await screen.findByText('News row')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /external/i }))
    // filter chip toggles a refetch; getNews called again with origin
    expect(api.getNews).toHaveBeenCalledWith(expect.objectContaining({ origin: 'external' }))
  })
})
