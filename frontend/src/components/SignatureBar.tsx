import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { useColorScheme } from '@mui/material/styles'
import { Sun, Moon, Sparkles, Search, CalendarClock, AlertTriangle } from 'lucide-react'
import { getDeadlines, getTasks } from '@/api'
import { formatCountdown } from '@/widgets/DeadlinesWidget'
import { useFriendlyTime, useClockFormat, useTimeZone } from '@/lib/timePrefs'
import { TimelineFlank } from '@/components/TimelineFlank'
import { bucketDeadlines, clockPercent, type Urgency, type AxisDeadline } from '@/lib/horizon'

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

const dotAnimation = (u: Urgency) =>
  u === 'critical'
    ? { '@media (prefers-reduced-motion: no-preference)': { animation: 'horizonFlash 0.8s steps(2) infinite' } }
    : u === 'urgent'
      ? { '@media (prefers-reduced-motion: no-preference)': { animation: 'horizonPulse 2s ease-in-out infinite' } }
      : {}

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
  const navigate = useNavigate()
  const friendly = useFriendlyTime()
  const clock = useClockFormat()
  const timeZone = useTimeZone()
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
  // Unified lists: deadlines + active dated tasks, split into upcoming vs overdue.
  const nowMs = Date.now()
  const activeTask = (t: typeof tasks[number]) => t.due_at && t.status !== 'done' && t.status !== 'dismissed'
  const upcomingItems = [
    ...deadlines.filter((d) => d.countdown_seconds > 0)
      .map((d) => ({ key: `d${d.id}`, title: d.title, when: d.due_at, type: 'deadline' as const })),
    ...tasks.filter((t) => activeTask(t) && new Date(t.due_at as string).getTime() >= nowMs)
      .map((t) => ({ key: `t${t.id}`, title: t.title, when: t.due_at as string, type: 'task' as const })),
  ].sort((a, b) => a.when.localeCompare(b.when))
  const overdueItems = [
    ...deadlines.filter((d) => d.countdown_seconds <= 0)
      .map((d) => ({ key: `d${d.id}`, title: d.title, when: d.due_at, type: 'deadline' as const })),
    ...tasks.filter((t) => activeTask(t) && new Date(t.due_at as string).getTime() < nowMs)
      .map((t) => ({ key: `t${t.id}`, title: t.title, when: t.due_at as string, type: 'task' as const })),
  ].sort((a, b) => a.when.localeCompare(b.when))

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const nowPercent = clockPercent(time)
  const { onAxis } = bucketDeadlines(deadlines, time)

  const dotTip = (a: AxisDeadline) =>
    `${a.deadline.title} — due ${friendly(a.deadline.due_at)} · ${formatCountdown(a.deadline.countdown_seconds)}`

  return (
    <Box sx={{ height: 48, display: 'flex', alignItems: 'center', px: 2, gap: 1.5, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{
        '@keyframes horizonPulse': { '0%,100%': { opacity: 0.55, transform: 'translate(-50%,-50%) scale(1)' }, '50%': { opacity: 1, transform: 'translate(-50%,-50%) scale(1.35)' } },
        '@keyframes horizonFlash': { '0%': { opacity: 1 }, '100%': { opacity: 0.3 } },
        '@keyframes nowPulse': { '0%,100%': { opacity: 0.8 }, '50%': { opacity: 1 } },
      }} />
      <Typography variant="h6" sx={{ fontSize: 18, mr: 1 }}>SCOUT</Typography>

      {/* overdue flank (left of the timeline = the past) */}
      <TimelineFlank
        items={overdueItems} title="Overdue" icon={<AlertTriangle size={16} />} accent="error"
        bucketOrder={OVERDUE_ORDER} bucketOf={(iso) => overdueBucketOf(iso, time)} compactWhen={compactWhen}
      />

      <Box sx={{ position: 'relative', flex: 8, height: 32 }}>
        {/* horizon line */}
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 3, borderRadius: 1, background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-2))' }} />

        {/* deadline dots on the today axis */}
        {onAxis.map((a) => (
          <Tooltip key={a.deadline.id} title={dotTip(a)} arrow>
            <Box
              role="button" tabIndex={0} aria-label={dotTip(a)}
              onClick={() => navigate('/deadlines')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/deadlines') } }}
              sx={{
                position: 'absolute', left: `${a.percent}%`, top: '50%', transform: 'translate(-50%,-50%)',
                width: 10, height: 10, borderRadius: '50%', cursor: 'pointer',
                bgcolor: URGENCY_COLOR[a.urgency], border: '2px solid', borderColor: 'background.paper',
                boxShadow: a.urgency === 'critical' || a.urgency === 'urgent' ? `0 0 6px ${URGENCY_COLOR[a.urgency]}` : 'none',
                '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: 2 },
                ...dotAnimation(a.urgency),
              }}
            />
          </Tooltip>
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
