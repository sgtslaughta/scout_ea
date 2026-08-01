import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import type { FinanceResponse, Quote } from '@/api'
import { safeHttpUrl } from '@/lib/url'
import { TickerPopover, priceFmt } from './TickerPopover'

export interface FinanceStripProps {
  finance: FinanceResponse
}

const yahooUrl = (symbol: string): string =>
  `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`

export function FinanceStrip({ finance }: FinanceStripProps) {
  // Early return if error or both lists empty
  if (finance.error || (finance.watchlist.length === 0 && finance.indices.length === 0)) {
    return (
      <Box sx={{ p: 1.5, color: 'text.secondary' }}>
        <Typography variant="body2">Markets unavailable</Typography>
      </Box>
    )
  }

  const handleChipClick = (symbol: string) => {
    const url = safeHttpUrl(yahooUrl(symbol))
    if (url) window.open(url, '_blank', 'noopener')
  }

  const handleChipKeyDown = (e: React.KeyboardEvent, symbol: string) => {
    if (e.key === 'Enter') handleChipClick(symbol)
  }

  const renderQuote = (q: Quote, useName = false) => {
    const dir = q.change_pct == null ? 'flat' : q.change_pct > 0 ? 'up' : q.change_pct < 0 ? 'down' : 'flat'
    // theme palette tokens so green/red stay legible in light + dark
    const color = dir === 'up' ? 'success.main' : dir === 'down' ? 'error.main' : 'text.secondary'

    return (
        <Box
          key={q.symbol}
          data-testid={`quote-${q.symbol}`}
          data-dir={dir}
          onClick={() => handleChipClick(q.symbol)}
          onKeyDown={(e) => handleChipKeyDown(e, q.symbol)}
          onMouseEnter={(e) => { clearCloseTimer(); setHovered({ q, el: e.currentTarget }) }}
          onMouseLeave={scheduleClose}
          role="button"
          tabIndex={0}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
            border: '1px solid',
            borderColor: 'divider',
            cursor: 'pointer',
            transition: 'background-color 120ms',
            '&:hover': { bgcolor: 'action.selected' },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: 'text.primary' }}>
            {useName ? (q.name || q.symbol) : q.symbol}
          </Typography>
          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8125rem', color }}>
            {q.price != null && priceFmt.format(q.price)}
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color }}>
            {dir === 'up' && '▲'}
            {dir === 'down' && '▼'}
            {q.change_pct?.toFixed(2)}%
          </Typography>
        </Box>
    )
  }

  // Indices first (market context), then the user's own watchlist.
  const merged = useMemo(
    () => [
      ...finance.indices.map((q) => ({ q, useName: true })),
      ...finance.watchlist.map((q) => ({ q, useName: false })),
    ],
    [finance.indices, finance.watchlist],
  )

  const rowRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState<{ q: Quote; el: HTMLElement } | null>(null)

  // The popover paper is portaled outside the chip/container DOM, so a chip's
  // onMouseLeave can't tell whether the pointer landed on the paper or left
  // the strip entirely. Close on a short delay instead of immediately, and
  // let the paper's onMouseEnter cancel it if the pointer made it across the
  // gap. Without this, moving off a chip without touching the paper (e.g.
  // sideways along the row, or straight off the strip) would leave `hovered`
  // set forever, since nothing else ever clears it.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  useEffect(() => clearCloseTimer, [])
  const scheduleClose = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setHovered(null), 120)
  }

  // Measure one copy of the track so the scroll distance and duration match
  // the real content width — a fixed duration would run at wildly different
  // speeds depending on how many symbols are in the watchlist.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const measure = () => setTrackWidth(el.scrollWidth / 2)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [merged.length])

  // ~40px/sec reads comfortably without becoming a distraction.
  const durationSec = trackWidth > 0 ? trackWidth / 40 : 0
  // `hovered` pins the marquee while a popover is open — the paper is portaled
  // and anchored to a chip, so letting the row scroll would drag the popover
  // off its anchor.
  const running = !paused && !hovered && durationSec > 0

  return (
    <Box
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); scheduleClose() }}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        borderRadius: 1,
        // theme.vars is only populated under cssVariables (enabled for this app);
        // fall back to alpha() for callers/tests without the CSS-vars ThemeProvider.
        backgroundColor: theme.vars
          ? `rgba(${theme.vars.palette.background.paperChannel} / 0.72)`
          : alpha(theme.palette.background.paper, 0.72),
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: 'divider',
      })}
    >
      <Box
        ref={rowRef}
        data-testid="finance-row"
        sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
      >
        <Box
          ref={trackRef}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, width: 'max-content',
            // Two identical copies scrolling by exactly one copy's width, so
            // the loop point is seamless.
            '@keyframes ticker': {
              from: { transform: 'translateX(0)' },
              to: { transform: `translateX(-${trackWidth}px)` },
            },
            animation: durationSec > 0 ? `ticker ${durationSec}s linear infinite` : 'none',
            animationPlayState: running ? 'running' : 'paused',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          {[0, 1].map((copy) => (
            merged.map(({ q, useName }) => (
              <Box
                key={`${copy}-${q.symbol}`}
                data-chip
                aria-hidden={copy === 1 || undefined}
                sx={{ flexShrink: 0 }}
              >
                {renderQuote(q, useName)}
              </Box>
            ))
          ))}
        </Box>
      </Box>

      {hovered && (
        <TickerPopover
          quote={hovered.q}
          anchorEl={hovered.el}
          open
          onClose={() => setHovered(null)}
          onPaperEnter={clearCloseTimer}
        />
      )}

    </Box>
  )
}
