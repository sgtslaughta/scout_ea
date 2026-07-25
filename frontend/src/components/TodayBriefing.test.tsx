import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { TodayBriefing } from './TodayBriefing'
import * as api from '@/api'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

const payload = {
  date: '2026-07-12', summary: 'busy day',
  critical: [{ id: 5, title: 'Ship it', kind: 'deadline', nav: { view: '/tasks', id: 5 },
    countdown_seconds: 3600, rank: 1, score: 92, detail: 'Blocks the release train' }],
  risks: [{ id: 1, type: 'proactive', source: 'briefing', title: 'Renewal risk',
    status: 'new', priority: 3, created_at: '', polarity: 'risk', rank: 1, score: 88,
    summary: 'No reply from Vance in 4 days' }],
  opportunities: [],
  news_by_topic: [{ topic_id: 10, topic_name: 'AI', topic_priority: 1,
    items: [{ id: 2, title: 'Big model', status: 'new', category: 'news', rank: 1, score: 85,
      synopsis: 'A frontier model shipped today' }] }],
  people: [{ id: 3, name: 'Jane', importance: 5, active: 1, signals: [],
    rank: 1, score: 92, role: 'VP', org: 'Acme', notes: 'Owns the renewal' }],
  weather: null, finance: null,
}

function renderModal() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TodayBriefing open onClose={() => {}} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TodayBriefing', () => {
  beforeEach(() => vi.spyOn(api, 'getBriefing').mockResolvedValue(payload as never))
  afterEach(() => vi.restoreAllMocks())

  it('renders summary + section headers + ranked items with scores + context', async () => {
    renderModal()
    expect(await screen.findByText('busy day')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('Risks & Opportunities')).toBeInTheDocument()
    expect(screen.getByText('Ship it')).toBeInTheDocument()
    expect(screen.getByText('Renewal risk')).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()
    // depth: impact scores + summary/synopsis context, not just titles
    expect(screen.getAllByText('92').length).toBeGreaterThan(0)      // impact badge
    expect(screen.getByText('No reply from Vance in 4 days')).toBeInTheDocument()
    expect(screen.getByText('A frontier model shipped today')).toBeInTheDocument()
    expect(screen.getByText('due in 1h 0m')).toBeInTheDocument()      // deadline countdown
  })

  it('click-to-nav closes modal and routes', async () => {
    const onClose = vi.fn()
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><TodayBriefing open onClose={onClose} /></MemoryRouter>
      </QueryClientProvider>,
    )
    await userEvent.click(await screen.findByText('Ship it'))
    expect(navigateMock).toHaveBeenCalledWith('/tasks')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders the weather band region', async () => {
    vi.spyOn(api, 'getConfig').mockResolvedValue(
      { weather_lat: '40.71', weather_lon: '-74.01', weather_label: 'NYC' } as never)
    vi.spyOn(api, 'getWeather').mockResolvedValue(
      { condition: 'clear', temp: 20, is_day: true,
        sunrise: '2026-06-21T06:00:00Z', sunset: '2026-06-21T20:00:00Z', label: 'NYC' } as never)
    renderModal()
    expect(await screen.findByLabelText(/NYC/i)).toBeInTheDocument()
  })

  it('renders the finance strip region', async () => {
    vi.spyOn(api, 'getBriefing').mockResolvedValue(payload as never)
    vi.spyOn(api, 'getFinance').mockResolvedValue(
      { watchlist: [{ symbol: 'AAPL', price: 102, change_pct: 2 }], indices: [], stale: false } as never)
    renderModal()
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
  })

  it('renders the sky backdrop behind the modal content', async () => {
    renderModal()
    expect(await screen.findByTestId('sky-backdrop')).toBeInTheDocument()
  })

  it('re-paints the sky backdrop when the live clock crosses a phase boundary', async () => {
    vi.useFakeTimers()
    // 50 min before sunset — still 'day' (twilight window is 45 min).
    vi.setSystemTime(new Date('2026-06-21T19:10:00Z'))
    vi.spyOn(api, 'getConfig').mockResolvedValue(
      { weather_lat: '40.71', weather_lon: '-74.01', weather_label: 'NYC' } as never)
    vi.spyOn(api, 'getWeather').mockResolvedValue(
      { condition: 'clear', temp: 20, is_day: true,
        sunrise: '2026-06-21T06:00:00Z', sunset: '2026-06-21T20:00:00Z', label: 'NYC' } as never)

    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><TodayBriefing open onClose={() => {}} /></MemoryRouter>
      </QueryClientProvider>,
    )

    // Two SkyBackdrop instances render (modal-level + WeatherBand's own) — the modal's
    // is the first in DOM order since it's a sibling rendered ahead of the content.
    const modalBackdrop = () => screen.getAllByTestId('sky-backdrop')[0]

    // Flush the mocked query promises without relying on real-timer polling.
    await vi.waitFor(() => expect(modalBackdrop()).toHaveAttribute('data-phase', 'day'))

    // Advance the live clock 10 minutes — now 40 min before sunset, inside dusk window.
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(modalBackdrop()).toHaveAttribute('data-phase', 'dusk')
    vi.useRealTimers()
  })
})
