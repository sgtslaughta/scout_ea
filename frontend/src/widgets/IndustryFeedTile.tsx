import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { getNews, getTopics, type NewsItem, type Topic } from '@/api'
import { safeHttpUrl } from '@/lib/url'
import { useFriendlyTime } from '@/lib/timePrefs'
import { RowTaskButton } from '@/components/RowTaskButton'
import { useWidgetCount, useWidgetExpanded } from './WidgetCard'

const MAX_ROWS = 5
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** 1 = exact match ... 5 = tangential; missing relevance sorts last. */
export function sortByRelevance(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => (a.relevance ?? 6) - (b.relevance ?? 6))
}

function oneLineSynopsis(s?: string): string {
  if (!s) return ''
  const firstSentence = s.split(/(?<=[.!?])\s/)[0]
  return firstSentence.trim()
}

/** Plain-text, paste-friendly digest of the past 7 days' items, grouped by topic. */
export function buildWeeklySummary(items: NewsItem[], topics: Topic[], now: Date = new Date()): string {
  const topicName = new Map(topics.map((t) => [t.id, t.name]))
  const recent = items.filter((i) => i.event_at && now.getTime() - new Date(i.event_at).getTime() <= WEEK_MS)
  const sorted = sortByRelevance(recent)

  const groups = new Map<string, NewsItem[]>()
  for (const item of sorted) {
    const label = (item.topic_id != null && topicName.get(item.topic_id)) || 'Uncategorized'
    const group = groups.get(label) ?? []
    group.push(item)
    groups.set(label, group)
  }

  const dateLabel = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  const lines = [`Industry Feed — Week of ${dateLabel}`, '']
  for (const [label, groupItems] of groups) {
    lines.push(label)
    for (const item of groupItems) {
      const source = item.source || 'Unknown source'
      const synopsis = oneLineSynopsis(item.synopsis)
      lines.push(`- ${item.title} — ${source}${synopsis ? `: ${synopsis}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

function IndustryRow({ item, friendly }: { item: NewsItem; friendly: (iso: string) => string }) {
  const open = () => {
    const url = safeHttpUrl(item.url)
    if (url) window.open(url, '_blank', 'noopener')
  }
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      sx={{
        display: 'flex', flexDirection: 'column', gap: 0.5, py: 1, px: 1, borderRadius: 1, cursor: 'pointer',
        borderBottom: '1px solid', borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        '&:hover .row-task-action, &:focus-within .row-task-action': { opacity: 1 },
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>{item.title}</Typography>
        <Box onClick={(e) => e.stopPropagation()}>
          <RowTaskButton
            draft={{
              title: item.title,
              detail: item.synopsis,
              source: `Industry Feed — ${item.event_at ? friendly(item.event_at) : 'undated'}`,
            }}
          />
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">{item.source || 'Unknown source'}</Typography>
        {item.event_at && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {friendly(item.event_at)}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

export default function IndustryFeedTile() {
  const { data = [] } = useQuery({ queryKey: ['news'], queryFn: () => getNews(), refetchInterval: 15000 })
  const { data: topics = [] } = useQuery({ queryKey: ['topics'], queryFn: () => getTopics() })
  const friendly = useFriendlyTime()

  const sorted = useMemo(() => sortByRelevance(data), [data])
  useWidgetCount(sorted.length)
  const expanded = useWidgetExpanded()
  // The expand dialog shows everything; the grid tile stays scannable.
  const rows = expanded ? sorted : sorted.slice(0, MAX_ROWS)

  const copySummary = async () => {
    const text = buildWeeklySummary(data, topics)
    await navigator.clipboard.writeText(text)
    toast.success('Weekly summary copied')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5 }}>
      <Button
        startIcon={<Copy size={16} />}
        variant="outlined"
        size="small"
        onClick={copySummary}
        sx={{ alignSelf: 'flex-start' }}
      >
        Copy weekly summary
      </Button>
      <Stack sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        {rows.map((item) => (
          <IndustryRow key={item.id} item={item} friendly={friendly} />
        ))}
      </Stack>
    </Box>
  )
}
