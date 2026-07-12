import { Box, Typography, Button } from '@mui/material'
import { RefreshCw } from 'lucide-react'
import type { FeedView } from './types'

const TITLE: Record<FeedView, string> = {
  overview: 'Overview', trending: 'Trending', news: 'News', learning: 'Learning', topics: 'Topics', inbox: 'Inbox', actions: 'Actions',
}

/** Thin masthead: current view title + a context refresh. (View-specific actions live in
 *  each body; this bar carries the always-present refresh + title.) */
export function FeedContextBar({ view, onRefresh }: { view: FeedView; onRefresh: () => void }) {
  return (
    <Box sx={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{TITLE[view]}</Typography>
      <Box sx={{ flex: 1 }} />
      <Button size="small" variant="outlined" startIcon={<RefreshCw size={14} />} onClick={onRefresh} aria-label="Refresh feed">
        Refresh
      </Button>
    </Box>
  )
}
