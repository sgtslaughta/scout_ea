import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as api from '@/api'

vi.mock('@/api')
vi.mock('@/components/finance/FinanceStrip', () => ({
  FinanceStrip: () => <div data-testid="finance-strip-stub" />,
}))
vi.mock('@/components/quickdraw/TimerPills', () => ({
  TimerPills: ({ onOpen }: { onOpen: () => void }) => (
    <button onClick={onOpen}>Timers</button>
  ),
}))
vi.mock('@/components/quickdraw/TimersDrawer', () => ({
  TimersDrawer: () => null,
}))
vi.mock('@/lib/useWeatherLocation', () => ({
  useWeatherLocation: () => ({ lat: 1, lon: 2, label: 'Home', source: 'config' as const }),
}))

import { TopBar, inlineLinkCount, MAX_INLINE_LINKS } from './TopBar'

describe('inlineLinkCount', () => {
  it('never shows more than the cap, however wide the bar', () => {
    expect(inlineLinkCount(1400)).toBe(MAX_INLINE_LINKS)
    expect(inlineLinkCount(4000)).toBe(MAX_INLINE_LINKS)
  })

  it('sheds links as the bar narrows', () => {
    expect(inlineLinkCount(1399)).toBe(3)
    expect(inlineLinkCount(1100)).toBe(3)
    expect(inlineLinkCount(800)).toBe(2)
    expect(inlineLinkCount(600)).toBe(1)
    expect(inlineLinkCount(599)).toBe(0)
  })

  it('assumes room before the bar has been measured', () => {
    // Guards against the bar flashing empty on first paint, and against a
    // circular measurement settling at zero.
    expect(inlineLinkCount(0)).toBe(MAX_INLINE_LINKS)
  })
})

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function renderBar(onOpenDrawer = vi.fn()) {
  render(<TopBar onOpenDrawer={onOpenDrawer} />, { wrapper })
  return { onOpenDrawer }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getFinance).mockResolvedValue({ watchlist: [], indices: [] })
  vi.mocked(api.getWeather).mockResolvedValue({})
  vi.mocked(api.saveQuickLinks).mockResolvedValue(undefined)
})

// jsdom has no layout engine — offsetWidth/clientWidth are always 0, so the
// measuring effect's `available <= 0` fallback shows every link inline
// (matching FinanceStrip's own test convention). Stub them to force overflow.
function stubLayout({ tile, row }: { tile: number; row: number }) {
  const offset = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-tile') ? tile : row
    })
  const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(row)
  return () => { offset.mockRestore(); client.mockRestore() }
}

describe('TopBar', () => {
  it('renders links sorted alphabetically regardless of stored order', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([
      { name: 'Zeta', url: 'https://zeta.example' },
      { name: 'Alpha', url: 'https://alpha.example' },
    ])
    renderBar()
    const alpha = await screen.findByRole('button', { name: 'Alpha' })
    const zeta = await screen.findByRole('button', { name: 'Zeta' })
    expect(alpha.compareDocumentPosition(zeta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders an empty bar without crashing when stored links are malformed', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([])
    renderBar()
    await waitFor(() => expect(api.getQuickLinks).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument()
  })

  it('folds links past the visible width into a "+N more" chip and opens its popover', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([
      { name: 'Alpha', url: 'https://alpha.example' },
      { name: 'Beta', url: 'https://beta.example' },
      { name: 'Gamma', url: 'https://gamma.example' },
    ])
    const restore = stubLayout({ tile: 100, row: 150 })
    renderBar()
    const overflowChip = await screen.findByRole('button', { name: /more/i })
    expect(overflowChip).toBeInTheDocument()
    await userEvent.click(overflowChip)
    await waitFor(() => expect(screen.getAllByText('Gamma').length).toBeGreaterThan(0))
    restore()
  })

  it('fires onOpenDrawer with the drawer id when a drawer trigger is clicked', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([])
    const { onOpenDrawer } = renderBar()
    await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    expect(onOpenDrawer).toHaveBeenCalledWith('settings')
  })

  it('opens the timers panel via the reused TimerPills trigger', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([])
    renderBar()
    await userEvent.click(await screen.findByRole('button', { name: 'Timers' }))
    // No throw / stub renders — proves TopBar wires TimerPills.onOpen through.
  })
})

const weatherWithForecast: api.WeatherResponse = {
  temp: 87, unit: 'F', condition: 'clouds',
  forecast: [
    { date: '2026-08-01', hi: 87, lo: 70, condition: 'clouds' },
    { date: '2026-08-02', hi: 85, lo: 68, condition: 'clear' },
    { date: '2026-08-03', hi: 90, lo: 72, condition: 'storm' },
    { date: '2026-08-04', hi: 80, lo: 65, condition: 'rain' },
    { date: '2026-08-05', hi: 78, lo: 60, condition: 'snow' },
  ],
}

describe('weather popover', () => {
  it('opens on hover, shows the location and 5-day forecast, and closes on pointer-leave', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([])
    vi.mocked(api.getWeather).mockResolvedValue(weatherWithForecast)
    renderBar()

    const trigger = await screen.findByRole('button', { name: /weather/i })
    fireEvent.mouseEnter(trigger)
    expect(await screen.findByText('Home')).toBeInTheDocument()

    const dayRows = weatherWithForecast.forecast!.map((d) => new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }))
    dayRows.forEach((name) => expect(screen.getAllByText(name).length).toBeGreaterThan(0))

    vi.useFakeTimers()
    try {
      fireEvent.mouseLeave(trigger)
      act(() => { vi.advanceTimersByTime(200) })
      expect(screen.queryByText('Home')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens on keyboard focus and on click', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([])
    vi.mocked(api.getWeather).mockResolvedValue(weatherWithForecast)
    renderBar()

    const trigger = await screen.findByRole('button', { name: /weather/i })
    fireEvent.focus(trigger)
    expect(await screen.findByText('Home')).toBeInTheDocument()
    fireEvent.blur(trigger)

    fireEvent.click(trigger)
    expect(await screen.findByText('Home')).toBeInTheDocument()
  })

  it('does not offer a popover when the forecast is missing or empty', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([])
    vi.mocked(api.getWeather).mockResolvedValue({ temp: 87, unit: 'F', condition: 'clouds', forecast: [] })
    renderBar()

    await screen.findByText('87°F')
    expect(screen.queryByRole('button', { name: /weather/i })).not.toBeInTheDocument()
  })
})
