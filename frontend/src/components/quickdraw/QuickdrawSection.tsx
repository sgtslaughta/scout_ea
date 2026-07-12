import { type ReactNode } from 'react'
import { Box, Typography, Chip, Collapse } from '@mui/material'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface QuickdrawSectionProps {
  id: string
  label: string
  count: number
  collapsed: boolean
  onToggle: (id: string) => void
  loading?: boolean
  error?: boolean
  empty: string
  alwaysShowChildren?: boolean
  children: ReactNode
}

export function QuickdrawSection({ id, label, count, collapsed, onToggle, loading, error, empty, alwaysShowChildren, children }: QuickdrawSectionProps) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Box
        role="button" tabIndex={0} aria-expanded={!collapsed} aria-label={label}
        onClick={() => onToggle(id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(id) } }}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid var(--color-accent)' } }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <Typography variant="overline" sx={{ flex: 1, lineHeight: 1.6 }}>{label}</Typography>
        <Chip size="small" label={count} sx={{ height: 18, fontFamily: '"JetBrains Mono", monospace' }} />
      </Box>
      {!collapsed && (
        <Collapse in={!collapsed}>
          <Box sx={{ pb: 1 }}>
            {loading ? <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>Loading…</Typography>
              : error ? <Typography variant="caption" color="error" sx={{ px: 1.5 }}>Couldn't load</Typography>
              : (count === 0 && !alwaysShowChildren) ? <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, fontStyle: 'italic' }}>{empty}</Typography>
              : children}
          </Box>
        </Collapse>
      )}
    </Box>
  )
}
