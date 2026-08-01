import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '../theme'
import { LeftRail } from './LeftRail'
import * as api from '@/api'

function renderRail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <LeftRail />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('LeftRail', () => {
  it('renders the Calendar heading', async () => {
    vi.spyOn(api, 'getEvents').mockResolvedValue([])
    renderRail()
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument()
  })

  it('shows a friendly empty state when there are no meetings', async () => {
    vi.spyOn(api, 'getEvents').mockResolvedValue([])
    renderRail()
    expect(await screen.findByText('Nothing on the calendar today.')).toBeInTheDocument()
  })

  it('lists upcoming meetings in chronological order', async () => {
    const soon = new Date(Date.now() + 3600_000).toISOString()
    const later = new Date(Date.now() + 7200_000).toISOString()
    vi.spyOn(api, 'getEvents').mockResolvedValue([
      { id: 1, title: 'Later meeting', chosen_time: later, status: 'scheduled' },
      { id: 2, title: 'Sooner meeting', chosen_time: soon, status: 'scheduled' },
    ])
    renderRail()
    const titles = await screen.findAllByText(/meeting$/)
    expect(titles.map((t) => t.textContent)).toEqual(['Sooner meeting', 'Later meeting'])
  })

  it('excludes past meetings', async () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    const future = new Date(Date.now() + 3600_000).toISOString()
    vi.spyOn(api, 'getEvents').mockResolvedValue([
      { id: 1, title: 'Past meeting', chosen_time: past, status: 'scheduled' },
      { id: 2, title: 'Future meeting', chosen_time: future, status: 'scheduled' },
    ])
    renderRail()
    expect(await screen.findByText('Future meeting')).toBeInTheDocument()
    expect(screen.queryByText('Past meeting')).not.toBeInTheDocument()
  })

  it('shows a Join button only when a Teams link is present, and opens it', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    vi.spyOn(api, 'getEvents').mockResolvedValue([
      { id: 1, title: 'With link', chosen_time: future, status: 'scheduled', body: 'https://teams.microsoft.com/l/meetup-join/abc123' },
      { id: 2, title: 'No link', chosen_time: future, status: 'scheduled', body: 'no url here' },
    ])
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderRail()
    await screen.findByText('With link')
    const joinButtons = screen.getAllByRole('button', { name: /join/i })
    expect(joinButtons).toHaveLength(1)
    await userEvent.click(joinButtons[0])
    expect(openSpy).toHaveBeenCalledWith('https://teams.microsoft.com/l/meetup-join/abc123', '_blank', 'noopener')
  })
})
