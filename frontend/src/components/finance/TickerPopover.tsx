import { useId, useState } from 'react'
import { Box, Popover, Typography, ToggleButton, ToggleButtonGroup, useTheme } from '@mui/material'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine'
import { useQuery } from '@tanstack/react-query'
import { getFinanceHistory, type HistoryRange, type Quote } from '@/api'

const RANGES: HistoryRange[] = ['1d', '5d', '1w', '1m']

export interface TickerPopoverProps {
  quote: Quote
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  /** Called when the pointer enters the popover paper — lets the caller
   *  cancel a pending close-on-leave timer scheduled from the anchor chip. */
  onPaperEnter?: () => void
}

export function TickerPopover({ quote, anchorEl, open, onClose, onPaperEnter }: TickerPopoverProps) {
  const theme = useTheme()
  const gradientId = useId().replace(/:/g, '')
  const [range, setRange] = useState<HistoryRange>('1d')

  // Lazy: nothing is fetched until the popover actually opens.
  const { data } = useQuery({
    queryKey: ['finance-history', quote.symbol, range],
    queryFn: () => getFinanceHistory(quote.symbol, range),
    enabled: open,
    staleTime: 300_000,
  })

  const ohlc = [
    quote.open != null && `O ${quote.open}`,
    quote.high != null && `H ${quote.high}`,
    quote.low != null && `L ${quote.low}`,
    quote.volume != null && `Vol ${quote.volume}`,
  ].filter(Boolean).join(' · ')

  const points = data?.points ?? []
  // Reference baseline is the opening value for the selected range — "above
  // the line" matches the up/down semantics of change_pct elsewhere in the strip.
  const baseline = points[0]
  const min = points.length > 1 ? Math.min(...points) : baseline
  const max = points.length > 1 ? Math.max(...points) : baseline
  // MUI's area SparkLineChart anchors the y-domain at 0 by default. Financial
  // series vary by a tiny fraction of their absolute value, so an unconstrained
  // domain renders the line as visually flat. Constrain the axis to the series'
  // own range, padded 10% so the extremes aren't flush against the chart edges.
  const domainPad = max === min ? 0 : (max - min) * 0.1
  const domainMin = min - domainPad
  const domainMax = max + domainPad
  // Fraction of the plotted range (top = domainMax, bottom = domainMin) at which
  // the baseline sits — the boundary between the green (above) and red (below)
  // zones of the gradient. This MUST be computed against the same padded domain
  // passed to `yAxis` below, or the gradient cut and the ChartsReferenceLine will
  // disagree on where the baseline pixel is. Two stops at the same offset produce
  // a hard cut rather than a blend. Flat series (domainMax === domainMin) can't
  // divide; treat them as fully "above" (matches an unchanged/flat series reading
  // as neither a gain nor a loss, closer to success than error).
  const baselineOffset = domainMax === domainMin
    ? 1
    : Math.min(1, Math.max(0, (domainMax - baseline) / (domainMax - domainMin)))

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          onMouseEnter: onPaperEnter,
          onMouseLeave: onClose,
          sx: { pointerEvents: 'auto', p: 1.5, minWidth: 240 },
        },
      }}
      disableRestoreFocus
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
        {quote.name || quote.symbol}
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
        {ohlc}
      </Typography>

      <Box sx={{ height: 48, mb: 1 }}>
        {points.length > 1
          ? (
            <SparkLineChart
              data={points}
              height={48}
              color={`url(#${gradientId})`}
              area
              baseline={baseline}
              yAxis={{ min: domainMin, max: domainMax }}
              data-testid="finance-sparkline"
            >
              <defs>
                <linearGradient
                  id={gradientId}
                  data-testid="finance-sparkline-gradient"
                  x1={0} y1={0} x2={0} y2={1}
                >
                  <stop offset={baselineOffset} stopColor={theme.palette.success.main} />
                  <stop offset={baselineOffset} stopColor={theme.palette.error.main} />
                </linearGradient>
              </defs>
              <ChartsReferenceLine
                y={baseline}
                lineStyle={{ stroke: theme.palette.divider, strokeDasharray: '3 3' }}
              />
            </SparkLineChart>
          )
          : <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
              No history available
            </Typography>}
      </Box>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={range}
        onChange={(_, v) => { if (v) setRange(v as HistoryRange) }}
      >
        {RANGES.map((r) => (
          <ToggleButton key={r} value={r} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>
            {r}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Popover>
  )
}
