import { Box, Typography } from '@mui/material'
import { LayoutGrid, TrendingUp, Newspaper, GraduationCap, Hash } from 'lucide-react'
import type { FeedView } from './types'

const ITEMS: { id: FeedView; label: string; Icon: typeof Hash }[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutGrid },
  { id: 'trending', label: 'Trending', Icon: TrendingUp },
  { id: 'news', label: 'News', Icon: Newspaper },
  { id: 'learning', label: 'Learning', Icon: GraduationCap },
  { id: 'topics', label: 'Topics', Icon: Hash },
]

export function FeedRail({ view, onView }: { view: FeedView; onView: (v: FeedView) => void }) {
  return (
    <Box component="nav" aria-label="Data feed sections" sx={{ width: 150, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', py: 1, bgcolor: 'background.paper' }}>
      {ITEMS.map(({ id, label, Icon }) => {
        const active = view === id
        return (
          <Box
            key={id} role="button" tabIndex={0} aria-current={active} aria-label={label}
            onClick={() => onView(id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(id) } }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, cursor: 'pointer',
              color: active ? 'var(--color-accent)' : 'text.primary',
              borderLeft: '2px solid', borderColor: active ? 'var(--color-accent)' : 'transparent',
              bgcolor: active ? 'action.selected' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: -2 },
            }}
          >
            <Icon size={16} />
            <Typography variant="body2" sx={{ fontWeight: active ? 700 : 400 }}>{label}</Typography>
          </Box>
        )
      })}
    </Box>
  )
}
