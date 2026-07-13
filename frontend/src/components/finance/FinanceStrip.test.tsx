import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FinanceStrip } from './FinanceStrip'

const fin = {
  watchlist: [
    { symbol: 'AAPL', price: 102, open: 100, high: 105, low: 99, volume: 5000, change_pct: 2 },
    { symbol: 'MSFT', price: 98, open: 100, high: 101, low: 97, volume: 3000, change_pct: -2 },
  ],
  indices: [{ symbol: '^SPX', price: 5010, change_pct: 0.2 }],
  stale: false,
}

afterEach(() => vi.restoreAllMocks())

describe('FinanceStrip', () => {
  it('renders watchlist + indices chips with direction', () => {
    render(<FinanceStrip finance={fin} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('^SPX')).toBeInTheDocument()
    expect(screen.getByTestId('quote-AAPL').getAttribute('data-dir')).toBe('up')
    expect(screen.getByTestId('quote-MSFT').getAttribute('data-dir')).toBe('down')
  })
  it('click opens Stooq in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<FinanceStrip finance={fin} />)
    await userEvent.click(screen.getByTestId('quote-AAPL'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('stooq.com/q/?s=aapl.us'), '_blank', 'noopener')
  })
  it('shows unavailable state on error', () => {
    render(<FinanceStrip finance={{ watchlist: [], indices: [], error: 'unavailable' }} />)
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
  })
})
