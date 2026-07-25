import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography, IconButton, alpha } from '@mui/material'
import { ChevronDown } from 'lucide-react'
import type { FinanceResponse, Quote } from '@/api'
import { safeHttpUrl } from '@/lib/url'
import { packPages } from './paging'
import { TickerPopover } from './TickerPopover'

export interface FinanceStripProps {
  finance: FinanceResponse
  /** Auto-advance interval. Exposed so tests can drive it deterministically. */
  intervalMs?: number
}

const yahooUrl = (symbol: string): string =>
  `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`

export function FinanceStrip({ finance, intervalMs = 15000 }: FinanceStripProps) {
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
            {q.price?.toFixed(2)}
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
  const [widths, setWidths] = useState<number[]>([])
  const [available, setAvailable] = useState(0)
  const [page, setPage] = useState(0)
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

  // Measure chips + container, and re-measure on resize.
  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return
    const measure = () => {
      const chips = Array.from(el.querySelectorAll('[data-chip]')) as HTMLElement[]
      setWidths(chips.map((c) => c.offsetWidth))
      setAvailable(el.clientWidth)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [merged.length])

  const pages = useMemo(() => packPages(widths, available, 8), [widths, available])
  const pageCount = Math.max(1, pages.length)

  useEffect(() => { if (page >= pageCount) setPage(0) }, [page, pageCount])

  const advance = () => setPage((p) => (p + 1) % pageCount)

  useEffect(() => {
    // `hovered` pins rotation for as long as a popover is open, even if the
    // pointer has moved off the container and onto the (portaled) popover
    // paper itself — otherwise the row could rotate out from under an
    // anchored-but-now-clipped chip while its popover is still open.
    if (paused || hovered || pageCount <= 1) return
    const id = setInterval(advance, intervalMs)
    return () => clearInterval(id)
  }, [paused, hovered, pageCount, intervalMs])

  const activeIdx = pages[Math.min(page, pages.length - 1)] ?? merged.map((_, i) => i)
  const firstVisible = activeIdx[0] ?? 0
  const offset = widths.slice(0, firstVisible).reduce((a, w) => a + w + 8, 0)

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
        data-page={page}
        data-page-count={pageCount}
        sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
      >
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            transform: `translateX(${-offset}px)`,
            transition: 'transform 400ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          {merged.map(({ q, useName }) => (
            <Box key={q.symbol} data-chip sx={{ flexShrink: 0 }}>
              {renderQuote(q, useName)}
            </Box>
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

      {/* Dots only make sense with more than one page; the manual advance is always
          available so the control does not appear and vanish as the row is resized. */}
      {pageCount > 1 && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <Box key={i} sx={{
              width: 6, height: 6, borderRadius: '50%',
              bgcolor: i === page ? 'primary.main' : 'action.disabled',
            }} />
          ))}
        </Box>
      )}
      <IconButton size="small" aria-label="Next tickers" onClick={advance}>
        <ChevronDown size={16} />
      </IconButton>
    </Box>
  )
}
