import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Popover, Tooltip } from '@mui/material'
import { MarqueeText } from './MarqueeText'

export interface FlankItem { key: string; id: number; title: string; when: string; type: 'deadline' | 'task' }

interface TimelineFlankProps {
  items: FlankItem[]
  title: string
  icon: ReactNode
  accent: 'error' | 'neutral'
  bucketOrder: readonly string[]
  bucketOf: (iso: string) => string
  compactWhen: (iso: string) => string
}

const CAP = 10

/**
 * A timeline flank: a compact count trigger that opens a popover of clickable
 * upcoming/overdue items grouped into buckets, capped at 10 with a "more".
 * Deadline rows navigate to /deadlines, task rows to /tasks.
 */
export function TimelineFlank({ items, title, icon, accent, bucketOrder, bucketOf, compactWhen }: TimelineFlankProps) {
  const navigate = useNavigate()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [expanded, setExpanded] = useState(false)

  const shown = expanded ? items : items.slice(0, CAP)
  const hidden = items.length - shown.length
  const groups = bucketOrder
    .map((b) => ({ bucket: b, items: shown.filter((i) => bucketOf(i.when) === b) }))
    .filter((g) => g.items.length > 0)
  const close = () => { setAnchor(null); setExpanded(false) }
  const goto = (type: 'deadline' | 'task', id?: number) => { navigate(`${type === 'deadline' ? '/deadlines' : '/tasks'}${id ? `?focus=${id}` : ''}`); close() }
  const color = accent === 'error' ? 'error.main' : 'text.secondary'
  const hoverBg = accent === 'error' ? 'rgba(var(--mui-palette-error-mainChannel) / 0.12)' : 'action.hover'

  return (
    <>
      <Tooltip arrow title={title}>
        <Box
          role="button" tabIndex={0} aria-label={`${items.length} ${title.toLowerCase()} items`} aria-haspopup="true"
          onClick={(e) => setAnchor(e.currentTarget)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAnchor(e.currentTarget) } }}
          sx={{ flex: 1, minWidth: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, borderRadius: 1, cursor: 'pointer', color, '&:hover': { bgcolor: hoverBg, color: accent === 'error' ? 'error.main' : 'text.primary' }, '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: 2 } }}
        >
          {icon}
          <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace', color }}>{items.length}</Typography>
        </Box>
      </Tooltip>
      <Popover
        open={!!anchor} anchorEl={anchor} onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ minWidth: 260, maxWidth: 340, maxHeight: 420, overflowY: 'auto', p: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, px: 0.5, color }}>{title}{items.length ? ` (${items.length})` : ''}</Typography>
          {items.length === 0 && <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>Nothing {title.toLowerCase()}.</Typography>}
          {groups.map((g) => (
            <Box key={g.bucket} sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'text.secondary', px: 0.5, mt: 0.5 }}>{g.bucket}</Typography>
              {g.items.map((i) => (
                <Box
                  key={i.key} role="button" tabIndex={0} aria-label={`${i.type === 'deadline' ? 'Deadline' : 'Task'}: ${i.title}`}
                  onClick={() => goto(i.type, i.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goto(i.type, i.id) } }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.4, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid var(--color-accent)' } }}
                >
                  <Box component="span" sx={{ color: i.type === 'deadline' ? 'error.main' : 'primary.main', fontWeight: 700, fontSize: 11 }}>{i.type === 'deadline' ? 'D' : 'T'}</Box>
                  <Box sx={{ flex: 1, minWidth: 0, fontSize: '0.75rem' }}><MarqueeText text={i.title} /></Box>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{compactWhen(i.when)}</Typography>
                </Box>
              ))}
            </Box>
          ))}
          {hidden > 0 && (
            <Box
              role="button" tabIndex={0} onClick={() => setExpanded(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true) } }}
              sx={{ textAlign: 'center', py: 0.5, mt: 0.25, borderRadius: 1, cursor: 'pointer', color: 'primary.main', fontSize: 12, '&:hover': { bgcolor: 'action.hover' } }}
            >
              +{hidden} more
            </Box>
          )}
        </Box>
      </Popover>
    </>
  )
}
