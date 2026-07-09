import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'
import { getOutlook, getDeadlines, getTrends, getSignals, getActivity } from '@/api'

const ACCENT = 'var(--color-accent)'

/** Daily counts for the last `days` days from ISO timestamps (oldest first). */
export function dailyCounts(isoDates: string[], days: number, today: Date): number[] {
  const counts = new Array<number>(days).fill(0)
  const dayMs = 86400000
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() + dayMs
  for (const iso of isoDates) {
    const t = new Date(iso).getTime()
    const idx = days - 1 - Math.floor((end - 1 - t) / dayMs)
    if (idx >= 0 && idx < days) counts[idx] += 1
  }
  return counts
}

interface Tile {
  label: string
  value: number
  to?: string
  spark?: number[]
}

function StatTile({ tile }: { tile: Tile }) {
  const inner = (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 0.5, '&:hover': tile.to ? { borderColor: 'primary.main' } : undefined }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>{tile.label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <Typography variant="h5" fontFamily='"JetBrains Mono", monospace' color="primary">{tile.value}</Typography>
        {tile.spark && tile.spark.some((v) => v > 0) && (
          <Box sx={{ flex: 1, height: 28, minWidth: 0 }}>
            <SparkLineChart data={tile.spark} height={28} color={ACCENT} />
          </Box>
        )}
      </Box>
    </Paper>
  )
  return tile.to ? (
    <Link to={tile.to} aria-label={tile.label} style={{ textDecoration: 'none' }}>{inner}</Link>
  ) : inner
}

export default function KpiStrip() {
  const { data: outlook } = useQuery({ queryKey: ['outlook'], queryFn: getOutlook, refetchInterval: 15000 })
  const { data: deadlines = [] } = useQuery({ queryKey: ['deadlines'], queryFn: getDeadlines, refetchInterval: 15000 })
  const { data: trends = [] } = useQuery({ queryKey: ['trends'], queryFn: () => getTrends(), refetchInterval: 15000 })
  const { data: signals = [] } = useQuery({ queryKey: ['signals', 'new'], queryFn: () => getSignals('new'), refetchInterval: 15000 })
  const { data: activity = [] } = useQuery({ queryKey: ['activity'], queryFn: () => getActivity(10), refetchInterval: 15000 })

  const now = new Date()
  const tiles: Tile[] = [
    { label: 'Proactive', value: outlook?.proactive?.length ?? 0, to: '/inbox?type=proactive' },
    { label: 'Due Today', value: outlook?.tasks_due_today?.length ?? 0, to: '/tasks?due=today' },
    { label: 'Urgent (<24h)', value: deadlines.filter((d) => d.countdown_seconds < 86400).length, to: '/deadlines?due=24h' },
    { label: 'Rising', value: trends.filter((t) => (t.delta ?? 0) > 0).length, to: '/trending?dir=rising' },
    { label: 'Signals', value: signals.filter((s) => s.type !== 'proactive').length, to: '/inbox?status=new', spark: dailyCounts(signals.map((s) => s.created_at), 7, now) },
    { label: 'Skill Runs', value: activity.length, spark: [...activity].reverse().map((a) => a.items_created) },
  ]

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 1.5 }}>
      {tiles.map((t) => <StatTile key={t.label} tile={t} />)}
    </Box>
  )
}
