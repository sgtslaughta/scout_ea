import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Typography } from '@mui/material'
import { getNews, getLearning, type FeedFilters, type NewsItem, type LearningItem } from '@/api'
import { FeedItemCard } from './FeedItemCard'
import type { FeedItem } from './types'

interface Props { kind: 'news' | 'learning'; onSelect: (item: FeedItem) => void }

const ORIGINS = ['internal', 'external'] as const

/** Category list for news/learning with origin filter chips. */
export function FeedList({ kind, onSelect }: Props) {
  const [origin, setOrigin] = useState<string | undefined>(undefined)
  const filters: FeedFilters = origin ? { origin } : {}
  const { data = [] } = useQuery({
    queryKey: [kind, filters],
    queryFn: () => (kind === 'news' ? getNews(filters) : getLearning(filters)),
    refetchInterval: 15000,
  })
  const rows = data as (NewsItem | LearningItem)[]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', gap: 0.5, p: 1, flexShrink: 0 }}>
        {ORIGINS.map((o) => (
          <Chip
            key={o} label={o} size="small" variant={origin === o ? 'filled' : 'outlined'}
            onClick={() => setOrigin(origin === o ? undefined : o)}
          />
        ))}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 0.5 }}>
        {rows.length === 0
          ? <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>Nothing here yet.</Typography>
          : rows.map((r) => <FeedItemCard key={r.id} item={r} onSelect={() => onSelect(r)} />)}
      </Box>
    </Box>
  )
}
