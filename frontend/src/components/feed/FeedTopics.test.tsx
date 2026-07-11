import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '@/theme'
import { FeedTopics } from './FeedTopics'
import * as api from '@/api'

describe('FeedTopics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getTopics').mockResolvedValue([
      { id: 1, name: 'AI agents', priority: 2, max_suggest: 5, active: 1 },
    ])
  })
  it('renders a topic and an Add control', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark"><MemoryRouter><FeedTopics /></MemoryRouter></ThemeProvider></QueryClientProvider>)
    expect(await screen.findByText('AI agents')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add topic/i })).toBeInTheDocument()
  })
})
