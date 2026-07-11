import { useQuery } from '@tanstack/react-query'
import { Box, Typography } from '@mui/material'
import { getFeed, type FeedRecent } from '@/api'
import { FeedItemCard } from './FeedItemCard'
import { KeyPeopleCarousel } from './KeyPeopleCarousel'

const CATS = ['trending', 'news', 'learning', 'topics'] as const

/** Front page: KPI tiles (fixed) + key-people carousel (fixed) + recent stream (scrolls). */
export function FeedOverview({ onSelect }: { onSelect: (item: FeedRecent) => void }) {
  const { data } = useQuery({ queryKey: ['feed'], queryFn: getFeed, refetchInterval: 15000 })
  const counts = data?.counts ?? {}
  const recent = data?.recent ?? []
  return (
    <Box sx={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 1.5, height: '100%', minHeight: 0, p: 1.5 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {CATS.map((c) => (
          <Box key={c} sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography sx={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {counts[c] ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>{c}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary">Key people</Typography>
        <KeyPeopleCarousel items={recent} onSelect={onSelect} />
      </Box>
      <Box sx={{ minHeight: 0, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1, pt: 0.5, display: 'block' }}>Recent</Typography>
        {recent.length === 0
          ? <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>Nothing recent yet.</Typography>
          : recent.map((it) => <FeedItemCard key={`${it.category}${it.id}`} item={it} onSelect={() => onSelect(it)} />)}
      </Box>
    </Box>
  )
}
