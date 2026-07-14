import { Box, Typography, Tooltip } from '@mui/material'
import type { FinanceResponse, Quote } from '@/api'
import { safeHttpUrl } from '@/lib/url'

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

    const tooltipTitle = [
      q.open != null && `O ${q.open}`,
      q.high != null && `H ${q.high}`,
      q.low != null && `L ${q.low}`,
      q.volume != null && `Vol ${q.volume}`,
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <Tooltip key={q.symbol} title={tooltipTitle || ''} arrow>
        <Box
          data-testid={`quote-${q.symbol}`}
          data-dir={dir}
          onClick={() => handleChipClick(q.symbol)}
          onKeyDown={(e) => handleChipKeyDown(e, q.symbol)}
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
      </Tooltip>
    )
  }

  const groupLabel = (text: string) => (
    <Typography
      sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.5 }}
    >
      {text}
    </Typography>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: { xs: 1, md: 1 },
        columnGap: { xs: 1.5, md: 3 },
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {finance.watchlist.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {groupLabel('Watchlist')}
          {finance.watchlist.map((q) => renderQuote(q))}
        </Box>
      )}
      {finance.indices.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {groupLabel('Markets')}
          {finance.indices.map((q) => renderQuote(q, true))}
        </Box>
      )}
    </Box>
  )
}
