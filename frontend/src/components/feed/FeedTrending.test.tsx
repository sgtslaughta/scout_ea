import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '@/theme'
import { FeedTrending } from './FeedTrending'
import * as api from '@/api'

describe('FeedTrending', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getTrends').mockResolvedValue([
      { id: 1, term: 'agents', kind: 'topic', window_start: 'w', window_end: 'w', score: 2.5 },
    ])
  })
  it('renders the trend term', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark"><MemoryRouter><FeedTrending /></MemoryRouter></ThemeProvider></QueryClientProvider>)
    expect(await screen.findByText('agents')).toBeInTheDocument()
  })
})
