import { Box, Typography } from '@mui/material'
import { TagChips } from '@/components/TagChips'
import { useFriendlyTime } from '@/lib/timePrefs'
import type { FeedItem } from './types'

interface Props { item: FeedItem; onSelect: (item: FeedItem) => void }

/** Shared feed row: title + source/time + SP1 tag/link chips. Click → onSelect (opens detail). */
export function FeedItemCard({ item, onSelect }: Props) {
  const friendly = useFriendlyTime()
  const when = (item as { when?: string; event_at?: string }).when ?? (item as { event_at?: string }).event_at
  return (
    <Box
      role="button" tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item) } }}
      sx={{
        display: 'flex', flexDirection: 'column', gap: 0.5, p: 1, borderRadius: 1, cursor: 'pointer',
        borderBottom: '1px solid', borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: -2 },
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        {when && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
            {friendly(when)}
          </Typography>
        )}
        <TagChips tags={item.tags ?? []} links={item.links ?? []} />
      </Box>
    </Box>
  )
}
