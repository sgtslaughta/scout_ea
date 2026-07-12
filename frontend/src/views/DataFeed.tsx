import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { getFeed } from '@/api'
import { FeedContextBar } from '@/components/feed/FeedContextBar'
import { NewsWire } from '@/components/feed/NewsWire'
import { FeedRail } from '@/components/feed/FeedRail'
import { FeedOverview } from '@/components/feed/FeedOverview'
import { FeedList } from '@/components/feed/FeedList'
import { FeedTrending } from '@/components/feed/FeedTrending'
import { FeedTopics } from '@/components/feed/FeedTopics'
import { FeedInboxSection } from '@/components/feed/FeedInboxSection'
import { FeedActionsSection } from '@/components/feed/FeedActionsSection'
import { FeedDetail } from '@/components/feed/FeedDetail'
import type { FeedView, FeedItem, FeedSelection } from '@/components/feed/types'

const VIEWS: FeedView[] = ['overview', 'inbox', 'actions', 'trending', 'news', 'learning', 'topics']

export function DataFeedView() {
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const initial = (params.get('view') as FeedView) ?? 'overview'
  const [view, setView] = useState<FeedView>(VIEWS.includes(initial) ? initial : 'overview')
  const [selection, setSelection] = useState<FeedSelection | null>(null)

  const { data: feed } = useQuery({ queryKey: ['feed'], queryFn: getFeed, refetchInterval: 15000 })
  const headlines = useMemo(
    () => (feed?.recent ?? []).filter((r) => r.category === 'news' || r.category === 'trending'),
    [feed],
  )

  const select = (category: string) => (item: FeedItem) =>
    setSelection({ category, id: (item as { id: number }).id, item })

  const refresh = () => qc.invalidateQueries({ queryKey: ['feed'] })

  return (
    <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FeedContextBar view={view} onRefresh={refresh} />
      <NewsWire items={headlines} onSelect={(it) => setSelection({ category: it.category, id: it.id, item: it })} />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        <FeedRail view={view} onView={(v) => { setView(v); setSelection(null) }} />
        <Box sx={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
          {view === 'overview' && <FeedOverview onSelect={(it) => setSelection({ category: it.category, id: it.id, item: it })} />}
          {view === 'inbox' && <FeedInboxSection />}
          {view === 'actions' && <FeedActionsSection />}
          {view === 'news' && <FeedList kind="news" onSelect={select('news')} />}
          {view === 'learning' && <FeedList kind="learning" onSelect={select('learning')} />}
          {view === 'trending' && <FeedTrending />}
          {view === 'topics' && <FeedTopics />}
          <FeedDetail selection={selection} onClose={() => setSelection(null)} />
        </Box>
      </Box>
    </Box>
  )
}
