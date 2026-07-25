import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FinanceStrip } from './FinanceStrip'

vi.mock('@/api', async () => ({
  ...(await vi.importActual<any>('@/api')),
  getFinanceHistory: vi.fn().mockResolvedValue({ symbol: 'x', range: '1d', points: [] }),
}))

// FinanceStrip mounts a TickerPopover (react-query) on chip hover, so every
// render needs a QueryClient in scope.
function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

const fin = {
  watchlist: [
    { symbol: 'AAPL', price: 102, open: 100, high: 105, low: 99, volume: 5000, change_pct: 2 },
    { symbol: 'MSFT', price: 98, open: 100, high: 101, low: 97, volume: 3000, change_pct: -2 },
  ],
  indices: [{ symbol: '^GSPC', name: 'S&P 500', price: 5010, change_pct: 0.2 }],
  stale: false,
}

afterEach(() => vi.restoreAllMocks())

describe('FinanceStrip', () => {
  it('renders watchlist + indices chips with direction', () => {
    wrap(<FinanceStrip finance={fin} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('S&P 500')).toBeInTheDocument()   // index shows friendly name
    expect(screen.getByTestId('quote-AAPL').getAttribute('data-dir')).toBe('up')
    expect(screen.getByTestId('quote-MSFT').getAttribute('data-dir')).toBe('down')
  })
  it('click opens Yahoo Finance in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrap(<FinanceStrip finance={fin} />)
    await userEvent.click(screen.getByTestId('quote-AAPL'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('finance.yahoo.com/quote/AAPL'), '_blank', 'noopener')
  })
  it('shows unavailable state on error', () => {
    wrap(<FinanceStrip finance={{ watchlist: [], indices: [], error: 'unavailable' }} />)
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
  })
})

const finance = {
  watchlist: [{ symbol: 'AAPL', price: 1, change_pct: 1 }],
  indices: [{ symbol: '^GSPC', name: 'S&P 500', price: 2, change_pct: -1 }],
}

it('renders indices and watchlist in one merged row', () => {
  wrap(<FinanceStrip finance={finance} />)
  expect(screen.getByTestId('finance-row')).toBeInTheDocument()
  // Both groups present, no separate WATCHLIST / MARKETS group rows
  expect(screen.getByTestId('quote-^GSPC')).toBeInTheDocument()
  expect(screen.getByTestId('quote-AAPL')).toBeInTheDocument()
})

// jsdom has no layout engine: offsetWidth/clientWidth are always 0, and
// packPages falls back to a single page when `available <= 0`. Rotation can
// therefore NEVER occur in jsdom unless these are stubbed. Without this
// helper the rotation test silently passes against a component that does not
// rotate at all.
function stubLayout({ chip, row }: { chip: number; row: number }) {
  const offset = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-chip') ? chip : row
    })
  const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockReturnValue(row)
  return () => { offset.mockRestore(); client.mockRestore() }
}

const many = {
  indices: Array.from({ length: 6 }, (_, i) => ({
    symbol: `^IDX${i}`, name: `Index ${i}`, price: 100 + i, change_pct: 1,
  })),
  watchlist: Array.from({ length: 6 }, (_, i) => ({
    symbol: `SYM${i}`, price: 50 + i, change_pct: -1,
  })),
}

it('advances the page on the interval and wraps at the end', () => {
  // 12 chips of 100px in a 250px row => 3 pages
  const restore = stubLayout({ chip: 100, row: 250 })
  vi.useFakeTimers()
  wrap(<FinanceStrip finance={many} intervalMs={1000} />)

  const row = () => screen.getByTestId('finance-row')
  expect(row()).toHaveAttribute('data-page', '0')

  act(() => { vi.advanceTimersByTime(1100) })
  expect(row()).toHaveAttribute('data-page', '1')

  // keep advancing until it must have wrapped back to 0
  const pages = Number(row().getAttribute('data-page-count'))
  expect(pages).toBeGreaterThan(1)
  // Total elapsed must be an exact multiple of intervalMs to land on page 0.
  // After the first 1100ms advance we're mid-interval, so add (pages-1) full
  // intervals plus the 100ms remainder — NOT 1100*pages, whose 10% buffer
  // compounds and overshoots by a tick.
  act(() => { vi.advanceTimersByTime(1000 * (pages - 1) + 100) })
  expect(row()).toHaveAttribute('data-page', '0')

  vi.useRealTimers()
  restore()
})

it('pauses rotation while hovered', async () => {
  const restore = stubLayout({ chip: 100, row: 250 })
  vi.useFakeTimers()
  wrap(<FinanceStrip finance={many} intervalMs={1000} />)
  const row = () => screen.getByTestId('finance-row')

  fireEvent.mouseEnter(row().parentElement!)
  act(() => { vi.advanceTimersByTime(5000) })
  expect(row()).toHaveAttribute('data-page', '0')   // frozen while hovered

  fireEvent.mouseLeave(row().parentElement!)
  act(() => { vi.advanceTimersByTime(1100) })
  expect(row()).toHaveAttribute('data-page', '1')   // resumes on leave

  vi.useRealTimers()
  restore()
})

it('advances when the manual button is pressed', async () => {
  wrap(<FinanceStrip finance={finance} intervalMs={999999} />)
  const btn = screen.getByRole('button', { name: /next tickers/i })
  await userEvent.click(btn)
  expect(screen.getByTestId('finance-row')).toBeInTheDocument()
})

// Regression: reviewer-reported bug. `hovered` was only ever cleared by the
// popover paper's onMouseLeave. If the pointer left a chip without crossing
// onto the (portaled) paper — moving sideways along the row, or straight off
// the strip — nothing cleared `hovered`, so rotation stayed pinned forever.
it('resumes rotation after the pointer leaves a chip without reaching the popover paper', () => {
  const restore = stubLayout({ chip: 100, row: 250 })
  vi.useFakeTimers()
  wrap(<FinanceStrip finance={many} intervalMs={1000} />)
  const row = () => screen.getByTestId('finance-row')

  fireEvent.mouseEnter(screen.getByTestId('quote-^IDX0'))
  fireEvent.mouseLeave(row().parentElement!)   // leaves the container; never touches the paper

  // Two acts: the first lets the close-delay timeout fire and its effect
  // (re-)register the rotation interval; the second gives that interval
  // room to actually tick. A single big advance would register the new
  // interval only after the whole window has already elapsed.
  act(() => { vi.advanceTimersByTime(200) })
  act(() => { vi.advanceTimersByTime(9800) })
  expect(row()).not.toHaveAttribute('data-page', '0')

  vi.useRealTimers()
  restore()
})

it('stays open (and keeps rotation paused) when the pointer moves from the chip onto the popover paper', () => {
  const restore = stubLayout({ chip: 100, row: 250 })
  vi.useFakeTimers()
  wrap(<FinanceStrip finance={many} intervalMs={1000} />)
  const row = () => screen.getByTestId('finance-row')

  fireEvent.mouseEnter(screen.getByTestId('quote-^IDX0'))
  fireEvent.mouseLeave(row().parentElement!)   // pointer leaves the container en route to the paper

  const rangeToggle = screen.getByRole('button', { name: '1d' })
  fireEvent.mouseEnter(rangeToggle.closest('.MuiPopover-paper')!)

  act(() => { vi.advanceTimersByTime(10000) })
  expect(row()).toHaveAttribute('data-page', '0')   // still pinned — popover never closed

  vi.useRealTimers()
  restore()
})
