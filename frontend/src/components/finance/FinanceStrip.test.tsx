import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
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
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S&P 500').length).toBeGreaterThan(0)   // index shows friendly name
    expect(screen.getAllByTestId('quote-AAPL')[0].getAttribute('data-dir')).toBe('up')
    expect(screen.getAllByTestId('quote-MSFT')[0].getAttribute('data-dir')).toBe('down')
  })
  it('formats the price chip with thousands separators', () => {
    wrap(<FinanceStrip finance={fin} />)
    expect(screen.getAllByText('5,010.00').length).toBeGreaterThan(0)
  })
  it('click opens Yahoo Finance in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrap(<FinanceStrip finance={fin} />)
    await userEvent.click(screen.getAllByTestId('quote-AAPL')[0])
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
  expect(screen.getAllByTestId('quote-^GSPC')[0]).toBeInTheDocument()
  expect(screen.getAllByTestId('quote-AAPL')[0]).toBeInTheDocument()
})

// jsdom reports scrollWidth as 0 (no layout engine), so trackWidth/durationSec
// are always 0 and the animation collapses to 'none' regardless of hover
// state — the established pattern in this file (see the old stubLayout
// helper) is to stub the relevant dimension so the real branch is exercised.
function stubScrollWidth(px: number) {
  const spy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(px)
  return () => spy.mockRestore()
}

describe('marquee track', () => {
  it('renders the track as two identical copies for a seamless loop', () => {
    wrap(<FinanceStrip finance={finance} />)
    const symbolCount = finance.indices.length + finance.watchlist.length
    const chips = document.querySelectorAll('[data-chip]')
    expect(chips.length).toBe(symbolCount * 2)
  })

  it('hides the second copy from the accessibility tree so each symbol has one accessible name', () => {
    wrap(<FinanceStrip finance={finance} />)
    const chips = Array.from(document.querySelectorAll('[data-chip]'))
    const visible = chips.filter((el) => el.getAttribute('aria-hidden') !== 'true')
    const hidden = chips.filter((el) => el.getAttribute('aria-hidden') === 'true')
    expect(visible.length).toBe(finance.indices.length + finance.watchlist.length)
    expect(hidden.length).toBe(finance.indices.length + finance.watchlist.length)
    // jsdom has no layout, so the accessible-name query naturally resolves to
    // the single non-hidden copy.
    expect(screen.getAllByRole('button', { name: /AAPL/ })).toHaveLength(1)
  })

  it('runs idle, pauses on hover, resumes on leave', () => {
    const restore = stubScrollWidth(800)   // trackWidth = 400 -> durationSec = 10
    wrap(<FinanceStrip finance={finance} />)
    const row = screen.getByTestId('finance-row')
    const track = row.firstElementChild as HTMLElement
    const strip = row.parentElement!

    expect(track).toHaveStyle({ animationPlayState: 'running' })

    fireEvent.mouseEnter(strip)
    expect(track).toHaveStyle({ animationPlayState: 'paused' })

    fireEvent.mouseLeave(strip)
    expect(track).toHaveStyle({ animationPlayState: 'running' })

    restore()
  })

  it('keeps the animation paused while a popover is open, even after the strip is left', () => {
    const restore = stubScrollWidth(800)
    wrap(<FinanceStrip finance={finance} />)
    const row = screen.getByTestId('finance-row')
    const track = row.firstElementChild as HTMLElement
    const strip = row.parentElement!

    fireEvent.mouseEnter(within(row).getAllByTestId('quote-AAPL')[0])
    fireEvent.mouseLeave(strip)

    expect(track).toHaveStyle({ animationPlayState: 'paused' })

    restore()
  })

  it('computes the animation duration from the measured track width', () => {
    const restore = stubScrollWidth(800)   // trackWidth = 400 -> durationSec = 10
    wrap(<FinanceStrip finance={finance} />)
    const row = screen.getByTestId('finance-row')
    const track = row.firstElementChild as HTMLElement

    // Emotion emits the animation via a generated class, and jsdom's
    // getComputedStyle doesn't expand that shorthand — read the emitted CSS.
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('')
    const rule = css.split('.').find((r) => track.className.split(' ').some((c) => r.startsWith(c)) && r.includes('animation'))
    expect(rule).toContain('10s')

    restore()
  })
})

// Regression: reviewer-reported bug. `hovered` was only ever cleared by the
// popover paper's onMouseLeave. If the pointer left a chip without crossing
// onto the (portaled) paper — moving sideways along the row, or straight off
// the strip — nothing cleared `hovered`, leaving the popover (and the pinned
// marquee) stuck open forever.
it('closes the popover after the pointer leaves a chip without reaching the popover paper', () => {
  vi.useFakeTimers()
  wrap(<FinanceStrip finance={finance} />)
  const row = screen.getByTestId('finance-row')
  const strip = row.parentElement!

  fireEvent.mouseEnter(within(row).getAllByTestId('quote-AAPL')[0])
  fireEvent.mouseLeave(strip)   // leaves the container; never touches the paper

  act(() => { vi.advanceTimersByTime(200) })

  expect(screen.queryByRole('button', { name: '1d' })).not.toBeInTheDocument()

  vi.useRealTimers()
})

it('keeps the popover open when the pointer moves from the chip onto the popover paper', () => {
  wrap(<FinanceStrip finance={finance} />)
  const row = screen.getByTestId('finance-row')

  fireEvent.mouseEnter(within(row).getAllByTestId('quote-AAPL')[0])

  const rangeToggle = screen.getByRole('button', { name: '1d' })
  fireEvent.mouseEnter(rangeToggle.closest('.MuiPopover-paper')!)
  fireEvent.mouseLeave(row.parentElement!)

  expect(screen.getByRole('button', { name: '1d' })).toBeInTheDocument()
})
