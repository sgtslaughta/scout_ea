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

// Spy on the yAxis prop passed to SparkLineChart while still rendering the real
// component, so we can assert the y-domain without reverse-engineering pixel geometry.
let lastSparkLineProps: any = null
vi.mock('@mui/x-charts/SparkLineChart', async () => {
  const React = await vi.importActual<any>('react')
  const actual = await vi.importActual<any>('@mui/x-charts/SparkLineChart')
  return {
    ...actual,
    SparkLineChart: (props: any) => {
      lastSparkLineProps = props
      return React.createElement(actual.SparkLineChart, props)
    },
  }
})

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

it('colours the sparkline line via a two-tone gradient, not a single flat colour', async () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  const container = await screen.findByTestId('finance-sparkline')
  const line = container.querySelector('.MuiLineChart-line') as SVGElement | null
  expect(line).not.toBeNull()
  // Line stroke must reference the per-instance gradient, not a flat theme colour —
  // that's what lets the zones (not just the overall trend) show green/red.
  expect(line?.getAttribute('stroke')).toMatch(/^url\(#.+\)$/)
})

it('builds the gradient with a hard green/red cut at the baseline offset (baseline 100, min 50, max 150 -> 0.5)', async () => {
  const { getFinanceHistory } = await import('@/api')
  // points[0] (100) is the baseline; series dips to 50 and rises to 150 around it.
  vi.mocked(getFinanceHistory).mockResolvedValueOnce({ symbol: 'AAPL', range: '1d', points: [100, 150, 50] })
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  const gradient = await screen.findByTestId('finance-sparkline-gradient')
  const stops = gradient.querySelectorAll('stop')
  expect(stops).toHaveLength(2)
  // Same offset on both stops -> hard boundary, not a blend.
  expect(stops[0].getAttribute('offset')).toBe('0.5')
  expect(stops[1].getAttribute('offset')).toBe('0.5')
  expect(stops[0].getAttribute('stop-color')).toBe(theme.palette.success.main)
  expect(stops[1].getAttribute('stop-color')).toBe(theme.palette.error.main)
})

it('constrains the y-domain to the series range instead of anchoring at zero, staying aligned with the gradient offset', async () => {
  const { getFinanceHistory } = await import('@/api')
  // min 50, max 150, baseline 100 (the midpoint) -> offset 0.5 either way,
  // but the point here is that the plotted domain must not start at 0.
  vi.mocked(getFinanceHistory).mockResolvedValueOnce({ symbol: 'AAPL', range: '1d', points: [100, 150, 50] })
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  await screen.findByTestId('finance-sparkline')
  expect(lastSparkLineProps.yAxis).toBeDefined()
  const { min: domainMin, max: domainMax } = lastSparkLineProps.yAxis
  expect(domainMin).toBeGreaterThan(0)
  expect(domainMax).toBeLessThan(1000) // sane, non-default bound
  expect(domainMin).toBeLessThan(50) // padded below the series min
  expect(domainMax).toBeGreaterThan(150) // padded above the series max

  // The gradient offset must agree with the same padded domain used for the axis —
  // i.e. offset == (domainMax - baseline) / (domainMax - domainMin).
  const gradient = await screen.findByTestId('finance-sparkline-gradient')
  const stops = gradient.querySelectorAll('stop')
  const expectedOffset = (domainMax - 100) / (domainMax - domainMin)
  expect(Number(stops[0].getAttribute('offset'))).toBeCloseTo(expectedOffset, 5)
})

it('clamps the gradient offset to a solid colour for a flat series (no division by zero)', async () => {
  const { getFinanceHistory } = await import('@/api')
  vi.mocked(getFinanceHistory).mockResolvedValueOnce({ symbol: 'AAPL', range: '1d', points: [100, 100, 100] })
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  wrap(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  const gradient = await screen.findByTestId('finance-sparkline-gradient')
  const stops = gradient.querySelectorAll('stop')
  expect(stops[0].getAttribute('offset')).toBe('1')
  expect(stops[1].getAttribute('offset')).toBe('1')
})
