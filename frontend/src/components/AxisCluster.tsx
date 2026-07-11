import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Tooltip, Popover } from '@mui/material'
import { MarqueeText } from './MarqueeText'
import { TimelineTypeChip } from './TimelineTypeChip'
import type { Urgency } from '@/lib/horizon'

export type AxisItemType = 'deadline' | 'task' | 'event'
export interface AxisDot { key: string; id: number; title: string; when: string; type: AxisItemType }

const ROUTE: Record<AxisItemType, string> = { deadline: '/deadlines', task: '/tasks', event: '/calendar' }
const TAG: Record<AxisItemType, string> = { deadline: 'D', task: 'T', event: 'E' }

interface AxisClusterProps {
  percent: number
  items: AxisDot[]
  color: string
  urgency: Urgency
  compactWhen: (iso: string) => string
}

/**
 * A dot on the timeline axis. A single item navigates on click; a cluster of
 * overlapping items opens a popover with per-item click-to-nav. Hover always
 * previews the contents.
 */
export function AxisCluster({ percent, items, color, urgency, compactWhen }: AxisClusterProps) {
  const navigate = useNavigate()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const multi = items.length > 1
  // Approaching items (critical/urgent) emit a radar-ping halo to draw the eye.
  const pinging = urgency === 'critical' || urgency === 'urgent'
  const size = multi ? 15 : 10
  const close = () => setAnchor(null)
  const go = (type: AxisItemType, id?: number) => { navigate(`${ROUTE[type]}${id ? `?focus=${id}` : ''}`); close() }
  const activate = (el: HTMLElement) => { if (multi) setAnchor(el); else go(items[0].type, items[0].id) }

  const tip = (
    <Box sx={{ p: 0.5 }}>
      {items.slice(0, 6).map((i) => (
        <Typography key={i.key} variant="caption" sx={{ display: 'block' }}>{TAG[i.type]} · {i.title} — {compactWhen(i.when)}</Typography>
      ))}
      {items.length > 6 && <Typography variant="caption" color="text.secondary">+{items.length - 6} more</Typography>}
      {multi && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Click to open</Typography>}
    </Box>
  )

  return (
    <>
      {pinging && (
        <Box
          aria-hidden data-testid="axis-ping"
          sx={{
            position: 'absolute', left: `${percent}%`, top: '50%', transform: 'translate(-50%,-50%)',
            width: size, height: size, borderRadius: '50%', bgcolor: color, pointerEvents: 'none',
            '@media (prefers-reduced-motion: reduce)': { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0.22 },
            '@media (prefers-reduced-motion: no-preference)': {
              '@keyframes axisPing': {
                '0%': { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.6 },
                '100%': { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0 },
              },
              animation: `axisPing ${urgency === 'critical' ? '1.4s' : '2.4s'} ease-out infinite`,
            },
          }}
        />
      )}
      <Tooltip arrow title={tip}>
        <Box
          role="button" tabIndex={0} aria-label={multi ? `${items.length} items` : items[0].title}
          onClick={(e) => activate(e.currentTarget)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e.currentTarget) } }}
          sx={{
            position: 'absolute', left: `${percent}%`, top: '50%', transform: 'translate(-50%,-50%)',
            width: size, height: size, borderRadius: '50%', cursor: 'pointer',
            bgcolor: color, border: '2px solid', borderColor: 'background.paper',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 6px ${color}`,
            '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: 2 },
          }}
        >
          {multi && <Typography sx={{ fontSize: 8, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{items.length}</Typography>}
        </Box>
      </Tooltip>
      {multi && (
        <Popover
          open={!!anchor} anchorEl={anchor} onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Box sx={{ minWidth: 240, maxWidth: 320, maxHeight: 320, overflowY: 'auto', p: 1 }}>
            {items.map((i) => (
              <Box
                key={i.key} role="button" tabIndex={0} aria-label={`${i.type}: ${i.title}`}
                onClick={() => go(i.type, i.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i.type, i.id) } }}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.4, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid var(--color-accent)' } }}
              >
                <TimelineTypeChip type={i.type} dense />
                <Box sx={{ flex: 1, minWidth: 0, fontSize: '0.75rem' }}><MarqueeText text={i.title} /></Box>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{compactWhen(i.when)}</Typography>
              </Box>
            ))}
          </Box>
        </Popover>
      )}
    </>
  )
}
