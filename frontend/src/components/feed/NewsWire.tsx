import { Box, Typography } from '@mui/material'
import { Radio } from 'lucide-react'
import type { FeedRecent } from '@/api'

interface Props { items: FeedRecent[]; onSelect: (item: FeedRecent) => void }

/** Slim always-on headline ticker. Marquee on wide screens (pause on hover);
 *  reduced-motion → a static horizontally-scrollable strip. Click → detail. */
export function NewsWire({ items, onSelect }: Props) {
  return (
    <Box sx={{
      height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 1.5,
      borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden',
      '@keyframes wire': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
    }}>
      <Radio size={14} style={{ flexShrink: 0, color: 'var(--color-accent)' }} />
      <Typography variant="caption" sx={{ flexShrink: 0, fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary' }}>WIRE</Typography>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {items.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No headlines yet.</Typography>
        ) : (
          <Box sx={{
            display: 'flex', gap: 3, whiteSpace: 'nowrap', width: 'max-content',
            '@media (prefers-reduced-motion: no-preference)': {
              animation: 'wire 40s linear infinite', '&:hover': { animationPlayState: 'paused' },
            },
            '@media (prefers-reduced-motion: reduce)': { overflowX: 'auto' },
          }}>
            {[...items, ...items].map((it, i) => (
              <Typography
                key={`${it.category}${it.id}-${i}`} component="span" variant="caption" role="button" tabIndex={0}
                onClick={() => onSelect(it)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(it) } }}
                sx={{ cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace', '&:hover': { color: 'var(--color-accent)' } }}
              >
                ▪ {it.title}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
