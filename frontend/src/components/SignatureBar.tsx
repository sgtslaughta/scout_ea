import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { useColorScheme } from '@mui/material/styles'
import { Sun, Moon, Sparkles, Search, CalendarClock, AlertTriangle } from 'lucide-react'
import { getDeadlines, getTasks, getEvents } from '@/api'
import { useClockFormat, useTimeZone, useWorkday } from '@/lib/timePrefs'
import { TimelineFlank } from '@/components/TimelineFlank'
import { AxisCluster, type AxisDot } from '@/components/AxisCluster'
import { clockPercent, inWorkday, clusterByProximity, sameLocalDay, urgencyOf, type Urgency } from '@/lib/horizon'

interface SignatureBarProps {
  onCommandOpen?: () => void
  onOpenBriefing?: () => void
}

// Urgency -> dot color + optional animation (gated by reduced-motion at use site).
const URGENCY_COLOR: Record<Urgency, string> = {
  critical: 'var(--mui-palette-error-main)',
  urgent: 'var(--mui-palette-error-main)',
  soon: 'var(--mui-palette-warning-main)',
  normal: 'var(--color-accent)',
}

const DAY_MS = 86400000
const BUCKET_ORDER = ['Today', 'Tomorrow', 'This week', 'Next week', 'Later'] as const
// Which day/week bucket a date falls into, relative to now.
function bucketOf(whenIso: string, now: Date): string {
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const w = new Date(whenIso); w.setHours(0, 0, 0, 0)
  const days = Math.round((w.getTime() - startToday.getTime()) / DAY_MS)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 7) return 'This week'
  if (days <= 14) return 'Next week'
  return 'Later'
}

const OVERDUE_ORDER = ['Today', 'This week', 'Older'] as const
function overdueBucketOf(whenIso: string, now: Date): string {
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const w = new Date(whenIso); w.setHours(0, 0, 0, 0)
  const days = Math.round((w.getTime() - startToday.getTime()) / DAY_MS)
  if (days === 0) return 'Today'
  if (days >= -7) return 'This week'
  return 'Older'
}

export function SignatureBar({ onCommandOpen, onOpenBriefing }: SignatureBarProps) {
  const [time, setTime] = useState(new Date())
  const { mode, systemMode, setMode } = useColorScheme()
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'dark'
  const clock = useClockFormat()
  const timeZone = useTimeZone()
  const workday = useWorkday()
  const compactTz = timeZone && timeZone !== 'auto' ? timeZone : undefined
  const compactWhen = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: compactTz })
  }

  const { data: deadlines = [] } = useQuery({
    queryKey: ['deadlines'], queryFn: () => getDeadlines(), refetchInterval: 15000,
  })
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 15000,
  })
  const { data: events = [] } = useQuery({
    queryKey: ['events'], queryFn: getEvents, refetchInterval: 15000,
  })

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Every dated item (deadlines + active tasks + scheduled events) with an urgency.
  const nowMs = Date.now()
  const secsUntil = (when: string) => Math.floor((new Date(when).getTime() - nowMs) / 1000)
  const activeTask = (t: typeof tasks[number]) => t.due_at && t.status !== 'done' && t.status !== 'dismissed'
  type Item = { key: string; title: string; when: string; type: 'deadline' | 'task' | 'event'; urgency: Urgency; past: boolean }
  const allItems: Item[] = [
    ...deadlines.map((d) => ({ key: `d${d.id}`, title: d.title, when: d.due_at, type: 'deadline' as const, urgency: urgencyOf(d.countdown_seconds), past: d.countdown_seconds <= 0 })),
    ...tasks.filter(activeTask).map((t) => { const w = t.due_at as string; const s = secsUntil(w); return { key: `t${t.id}`, title: t.title, when: w, type: 'task' as const, urgency: urgencyOf(s), past: s <= 0 } }),
    ...events.filter((e) => e.chosen_time).map((e) => { const w = e.chosen_time as string; const s = secsUntil(w); return { key: `e${e.id}`, title: e.title, when: w, type: 'event' as const, urgency: urgencyOf(s), past: s <= 0 } }),
  ]

  // ponytail: extract id from key (d123 → 123, t456 → 456)
  const extractId = (key: string) => { const n = parseInt(key.slice(1), 10); return Number.isNaN(n) ? 0 : n }

  // Timeline axis = items falling in today's workday span; everything else goes to a flank.
  const onAxis = (i: Item) => {
    const d = new Date(i.when)
    return !isNaN(d.getTime()) && sameLocalDay(d, time) && inWorkday(d, workday.start, workday.end)
  }
  const SEVERITY: Record<Urgency, number> = { critical: 3, urgent: 2, soon: 1, normal: 0 }
  const axisDots = allItems.filter(onAxis).map((i) => ({ ...i, percent: clockPercent(new Date(i.when), workday.start, workday.end) }))
  const clusters = clusterByProximity(axisDots).map((c) => {
    const worst = c.items.reduce<Urgency>((m, i) => (SEVERITY[i.urgency] > SEVERITY[m] ? i.urgency : m), 'normal')
    const items: AxisDot[] = c.items.map((i) => ({ key: i.key, id: extractId(i.key), title: i.title, when: i.when, type: i.type }))
    return { percent: c.percent, color: URGENCY_COLOR[worst], items }
  })

  // Flanks stay deadlines + tasks only (events live on the axis / calendar).
  const flankItem = (i: Item) => ({ key: i.key, id: extractId(i.key), title: i.title, when: i.when, type: i.type as 'deadline' | 'task' })
  const overdueItems = allItems.filter((i) => i.type !== 'event' && i.past && !onAxis(i)).map(flankItem).sort((a, b) => a.when.localeCompare(b.when))
  const upcomingItems = allItems.filter((i) => i.type !== 'event' && !i.past && !onAxis(i)).map(flankItem).sort((a, b) => a.when.localeCompare(b.when))

  const nowPercent = clockPercent(time, workday.start, workday.end)

  return (
    <Box sx={{ height: 48, display: 'flex', alignItems: 'center', px: 2, gap: 1.5, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ '@keyframes nowPulse': { '0%,100%': { opacity: 0.8 }, '50%': { opacity: 1 } } }} />
      <Typography variant="h6" sx={{ fontSize: 18, mr: 1 }}>SCOUT</Typography>

      {/* overdue flank (left of the timeline = the past) */}
      <TimelineFlank
        items={overdueItems} title="Overdue" icon={<AlertTriangle size={16} />} accent="error"
        bucketOrder={OVERDUE_ORDER} bucketOf={(iso) => overdueBucketOf(iso, time)} compactWhen={compactWhen}
      />

      <Box sx={{ position: 'relative', flex: 8, height: 32 }}>
        {/* horizon line */}
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 3, borderRadius: 1, background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-2))' }} />

        {/* dated items on the workday axis, overlaps clustered */}
        {clusters.map((c) => (
          <AxisCluster key={c.items[0].key} percent={c.percent} items={c.items} color={c.color} compactWhen={compactWhen} />
        ))}

        {/* now-marker + centered live time readout */}
        <Box sx={{ position: 'absolute', left: `${nowPercent}%`, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: 'text.secondary', lineHeight: 1, mb: '2px' }}>
            {clock(time)}
          </Typography>
          <Box sx={{
            width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderBottom: '10px solid var(--color-accent)', filter: 'drop-shadow(0 0 4px var(--color-accent))',
            '@media (prefers-reduced-motion: no-preference)': { animation: 'nowPulse 2s infinite' },
          }} />
        </Box>

      </Box>

      {/* upcoming flank (right of the timeline = the future) */}
      <TimelineFlank
        items={upcomingItems} title="Upcoming" icon={<CalendarClock size={16} />} accent="neutral"
        bucketOrder={BUCKET_ORDER} bucketOf={(iso) => bucketOf(iso, time)} compactWhen={compactWhen}
      />

      <IconButton size="small" onClick={onOpenBriefing} aria-label="Open today briefing">
        <Sparkles size={16} />
      </IconButton>
      <IconButton size="small" onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')} aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </IconButton>
      <Tooltip title="Search (⌘K)" arrow>
        <Button size="small" variant="outlined" onClick={onCommandOpen} aria-label="Search (command palette)" sx={{ minWidth: 0, px: 1, gap: 0.5, fontSize: 11 }}>
          <Search size={14} />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>⌘K</Box>
        </Button>
      </Tooltip>
    </Box>
  )
}
