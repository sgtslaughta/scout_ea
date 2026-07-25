import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { HoverCard } from './HoverCard'

export interface RankedItemProps {
  rank: number
  title: string
  score?: number
  scoreReason?: string
  subtitle?: string
  detail?: string
  why?: string
  meta?: string
  timestamp?: string
  onClick?: () => void
}

// impact band → badge colors (theme palette tokens; legible light + dark)
const scoreStyle = (s: number) =>
  s >= 80 ? { bg: 'error.main', fg: '#fff' } :
  s >= 60 ? { bg: 'warning.main', fg: 'rgba(0,0,0,0.87)' } :
  s >= 40 ? { bg: 'info.main', fg: '#fff' } :
            { bg: 'action.selected', fg: 'text.secondary' }

export function RankedItem({ rank, title, score, scoreReason, subtitle, detail, why, meta, timestamp, onClick }: RankedItemProps) {
  const clickable = !!onClick
  const badge = score != null ? scoreStyle(score) : null
  const [scoreAnchor, setScoreAnchor] = useState<HTMLElement | null>(null)
  const [rowAnchor, setRowAnchor] = useState<HTMLElement | null>(null)
  // The badge's explanation takes precedence over the row's own detail card
  // when both anchors are live (the badge sits inside the row's bounds, so
  // hovering/focusing it also fires the row's handlers) — never both open.
  const scoreOpen = !!scoreAnchor
  const rowOpen = !!rowAnchor && !scoreOpen && !!(detail || subtitle || why || meta || timestamp)
  return (
    <Box
      role={clickable ? 'button' : undefined}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickable && e.key === 'Enter') onClick?.()
        // Escape closes the row's own detail popover without also
        // closing the enclosing modal (which listens for Escape too).
        if (e.key === 'Escape' && rowOpen) { e.stopPropagation(); setRowAnchor(null) }
      }}
      onMouseEnter={(e) => setRowAnchor(e.currentTarget)}
      onMouseLeave={() => setRowAnchor(null)}
      onFocus={(e) => setRowAnchor(e.currentTarget)}
      onBlur={() => setRowAnchor(null)}
      sx={{
        display: 'flex',
        gap: 1.25,
        p: 1,
        borderRadius: 1,
        cursor: clickable ? 'pointer' : 'default',
        '&:hover': clickable ? { bgcolor: 'action.hover' } : undefined,
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      <Typography
        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'text.secondary',
              fontSize: '0.8rem', minWidth: 16, textAlign: 'right', pt: '2px' }}
      >
        {rank}
      </Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Typography
            sx={{ fontWeight: 600, fontSize: '0.875rem', flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {title}
          </Typography>
          {badge && (
            <>
              <Box
                tabIndex={0}
                aria-label={`Impact score ${score} explanation`}
                onMouseEnter={(e) => setScoreAnchor(e.currentTarget)}
                onMouseLeave={() => setScoreAnchor(null)}
                onFocus={(e) => setScoreAnchor(e.currentTarget)}
                onBlur={() => setScoreAnchor(null)}
                onKeyDown={(e) => {
                  // Escape closes just this popover, not the enclosing modal.
                  if (e.key === 'Escape' && scoreOpen) { e.stopPropagation(); setScoreAnchor(null) }
                }}
                sx={{ px: 0.75, py: '1px', borderRadius: 0.75, fontSize: '0.7rem', fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums', color: badge.fg, bgcolor: badge.bg,
                      lineHeight: 1.7, minWidth: 26, textAlign: 'center', flexShrink: 0,
                      cursor: 'help', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}
              >
                {score}
              </Box>
              <HoverCard
                anchorEl={scoreAnchor}
                open={scoreOpen}
                onClose={() => setScoreAnchor(null)}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.5 }}>
                  Impact {score} / 100
                </Typography>
                {scoreReason && (
                  <Typography sx={{ fontSize: '0.8rem', mb: 1 }}>{scoreReason}</Typography>
                )}
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  80–100 Critical · 60–79 High · 40–59 Medium · 0–39 Low
                </Typography>
              </HoverCard>
            </>
          )}
        </Box>
        {subtitle && (
          <Typography
            sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {subtitle}
          </Typography>
        )}
        {meta && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25 }}>{meta}</Typography>
        )}
      </Box>
      <HoverCard
        anchorEl={rowAnchor}
        open={rowOpen}
        onClose={() => setRowAnchor(null)}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.5 }}>{title}</Typography>
        {(detail || subtitle) && (
          <Typography sx={{ fontSize: '0.8rem', mb: 0.5 }}>{detail || subtitle}</Typography>
        )}
        {why && (
          <Typography sx={{ fontSize: '0.8rem', mb: 0.5 }}>
            <Typography component="span" sx={{ fontWeight: 700 }}>Why: </Typography>
            {why}
          </Typography>
        )}
        {meta && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{meta}</Typography>
        )}
        {timestamp && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{timestamp}</Typography>
        )}
      </HoverCard>
    </Box>
  )
}
