import { Box, Typography, Tooltip, useTheme } from '@mui/material'
import { FinanceResponse, Quote } from '@/api'
import { safeHttpUrl } from '@/lib/url'

export interface FinanceStripProps {
  finance: FinanceResponse
}

const toStooq = (symbol: string): string => {
  const s = symbol.toLowerCase()
  return s.startsWith('^') || s.includes('.') ? s : s + '.us'
}

export function FinanceStrip({ finance }: FinanceStripProps) {
  const theme = useTheme()

  // Early return if error or both lists empty
  if (finance.error || (finance.watchlist.length === 0 && finance.indices.length === 0)) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        <Typography>Markets unavailable</Typography>
      </Box>
    )
  }

  const handleChipClick = (symbol: string) => {
    const url = safeHttpUrl(`https://stooq.com/q/?s=${toStooq(symbol)}`)
    if (url) window.open(url, '_blank', 'noopener')
  }

  const handleChipKeyDown = (e: React.KeyboardEvent, symbol: string) => {
    if (e.key === 'Enter') {
      handleChipClick(symbol)
    }
  }

  const renderQuote = (q: Quote) => {
    const dir = q.change_pct == null ? 'flat' : q.change_pct > 0 ? 'up' : q.change_pct < 0 ? 'down' : 'flat'
    const isUp = dir === 'up'
    const isDown = dir === 'down'
    const color = isUp ? theme.palette.success.main : isDown ? theme.palette.error.main : theme.palette.text.secondary

    const tooltipTitle = [
      q.open !== undefined && `O ${q.open}`,
      q.high !== undefined && `H ${q.high}`,
      q.low !== undefined && `L ${q.low}`,
      q.volume !== undefined && `Vol ${q.volume}`,
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
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 1,
            bgcolor: 'action.hover',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.selected',
            },
            mr: 1,
            mb: 1,
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
            {q.symbol}
          </Typography>
          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem', color }}>
            {q.price?.toFixed(2)}
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color }}>
            {isUp && '▲'}
            {isDown && '▼'}
            {q.change_pct?.toFixed(2)}%
          </Typography>
        </Box>
      </Tooltip>
    )
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
      {finance.watchlist.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>
            Watchlist
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            {finance.watchlist.map(renderQuote)}
          </Box>
        </Box>
      )}
      {finance.indices.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>
            Markets
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            {finance.indices.map(renderQuote)}
          </Box>
        </Box>
      )}
    </Box>
  )
}
