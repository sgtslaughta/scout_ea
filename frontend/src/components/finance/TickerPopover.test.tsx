import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TickerPopover } from './TickerPopover'

vi.mock('@/api', async () => ({
  ...(await vi.importActual<any>('@/api')),
  getFinanceHistory: vi.fn().mockResolvedValue({ symbol: 'AAPL', range: '1d', points: [1, 2, 3] }),
}))

const quote = { symbol: 'AAPL', price: 100, open: 99, high: 101, low: 98, volume: 1000, change_pct: 1 }

function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

it('shows OHLC and the range toggles', async () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  expect(await screen.findByText(/AAPL/)).toBeInTheDocument()
  expect(screen.getByText(/O 99/)).toBeInTheDocument()
  for (const r of ['1d', '5d', '1w', '1m']) {
    expect(screen.getByRole('button', { name: r })).toBeInTheDocument()
  }
})

it('fetches a new range when a toggle is clicked', async () => {
  const { getFinanceHistory } = await import('@/api')
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  await userEvent.click(screen.getByRole('button', { name: '1m' }))
  expect(getFinanceHistory).toHaveBeenCalledWith('AAPL', '1m')
})
