import { Box, Typography, Avatar } from '@mui/material'
import type { FeedRecent } from '@/api'

interface Props { items: FeedRecent[]; onSelect: (item: FeedRecent) => void }

interface PersonCard { id: number; name: string; item: FeedRecent }

/** Latest feed item per linked person, as a horizontally-scrollable card row (no autoplay). */
export function KeyPeopleCarousel({ items, onSelect }: Props) {
  const byPerson = new Map<number, PersonCard>()
  for (const it of items) {
    for (const l of it.links ?? []) {
      if (l.target_type === 'person' && !byPerson.has(l.target_id)) {
        byPerson.set(l.target_id, { id: l.target_id, name: l.label, item: it })
      }
    }
  }
  const cards = [...byPerson.values()]
  if (cards.length === 0) {
    return <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>No key-people activity yet.</Typography>
  }
  return (
    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: 6 } }}>
      {cards.map((c) => (
        <Box
          key={c.id} role="button" tabIndex={0}
          onClick={() => onSelect(c.item)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.item) } }}
          sx={{
            flexShrink: 0, width: 220, p: 1, borderRadius: 1, cursor: 'pointer',
            border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
            '&:hover': { borderColor: 'var(--color-accent)' },
            '&:focus-visible': { outline: '2px solid var(--color-accent)' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Avatar sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'var(--color-accent)' }}>{c.name.charAt(0)}</Avatar>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{c.name}</Typography>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.item.title}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
