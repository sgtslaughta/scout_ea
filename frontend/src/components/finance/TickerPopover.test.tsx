import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '../../theme'
import { ThemeProvider } from '@mui/material/styles'
import { TickerPopover } from './TickerPopover'

vi.mock('@/api', async () => ({
  ...(await vi.importActual<any>('@/api')),
  getFinanceHistory: vi.fn().mockResolvedValue({ symbol: 'AAPL', range: '1d', points: [1, 2, 3] }),
}))

const quote = { symbol: 'AAPL', price: 100, open: 99, high: 101, low: 98, volume: 1000, change_pct: 1 }

function wrap(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  )
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

it('renders a reference line at the opening (first) point of the series', async () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  const container = await screen.findByTestId('finance-sparkline')
  expect(container.querySelector('.MuiChartsReferenceLine-line')).not.toBeNull()
})

it('colours the sparkline success (green) when the series is up over the range', async () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  const container = await screen.findByTestId('finance-sparkline')
  const line = container.querySelector('.MuiLineChart-line') as SVGElement | null
  expect(line).not.toBeNull()
  expect(line?.getAttribute('stroke')).toBe(theme.palette.success.main)
})

it('colours the sparkline error (red) when the series is down over the range', async () => {
  const { getFinanceHistory } = await import('@/api')
  vi.mocked(getFinanceHistory).mockResolvedValueOnce({ symbol: 'AAPL', range: '1d', points: [3, 2, 1] })
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  await screen.findByText(/AAPL/)
  const container = await screen.findByTestId('finance-sparkline')
  const line = container.querySelector('.MuiLineChart-line') as SVGElement | null
  expect(line?.getAttribute('stroke')).toBe(theme.palette.error.main)
})
