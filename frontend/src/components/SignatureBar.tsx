import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Popover from '@mui/material/Popover'
import { useColorScheme } from '@mui/material/styles'
import { Sun, Moon, Sparkles, Search, CalendarClock } from 'lucide-react'
import { getDeadlines, getTasks } from '@/api'
import { formatCountdown } from '@/widgets/DeadlinesWidget'
import { useFriendlyTime, useClockFormat } from '@/lib/timePrefs'
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

export function SignatureBar({ onCommandOpen, onOpenBriefing }: SignatureBarProps) {
  const [time, setTime] = useState(new Date())
  const { mode, systemMode, setMode } = useColorScheme()
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'dark'
  const navigate = useNavigate()
  const friendly = useFriendlyTime()
  const clock = useClockFormat()

  const { data: deadlines = [] } = useQuery({
    queryKey: ['deadlines'], queryFn: () => getDeadlines(), refetchInterval: 15000,
  })
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 15000,
  })
  // Unified upcoming list: future deadlines + future-dated active tasks.
  const nowMs = Date.now()
  const upcomingItems = [
    ...deadlines.filter((d) => d.countdown_seconds > 0)
      .map((d) => ({ key: `d${d.id}`, title: d.title, when: d.due_at, type: 'deadline' as const })),
    ...tasks.filter((t) => t.due_at && new Date(t.due_at).getTime() >= nowMs && t.status !== 'done' && t.status !== 'dismissed')
      .map((t) => ({ key: `t${t.id}`, title: t.title, when: t.due_at as string, type: 'task' as const })),
  ].sort((a, b) => a.when.localeCompare(b.when))

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const nowPercent = clockPercent(time)
  const { onAxis } = bucketDeadlines(deadlines, time)

  const [upcomingAnchor, setUpcomingAnchor] = useState<HTMLElement | null>(null)
  const [upcomingExpanded, setUpcomingExpanded] = useState(false)
  const UPCOMING_CAP = 10
  const shownUpcoming = upcomingExpanded ? upcomingItems : upcomingItems.slice(0, UPCOMING_CAP)
  const hiddenUpcoming = upcomingItems.length - shownUpcoming.length
  const groupedUpcoming = BUCKET_ORDER
    .map((b) => ({ bucket: b, items: shownUpcoming.filter((i) => bucketOf(i.when, time) === b) }))
    .filter((g) => g.items.length > 0)
  const closeUpcoming = () => { setUpcomingAnchor(null); setUpcomingExpanded(false) }
  const gotoItem = (type: 'deadline' | 'task') => { navigate(type === 'deadline' ? '/deadlines' : '/tasks'); closeUpcoming() }

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

      <Box sx={{ position: 'relative', flex: 9, height: 32 }}>
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

      {/* upcoming indicator (deadlines + tasks, grouped by day/week; click for a nav-able list) */}
      <Tooltip arrow title="Upcoming deadlines & tasks">
        <Box
          role="button" tabIndex={0} aria-label={`${upcomingItems.length} upcoming items`} aria-haspopup="true"
          onClick={(e) => setUpcomingAnchor(e.currentTarget)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUpcomingAnchor(e.currentTarget) } }}
          sx={{ flex: 1, minWidth: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, borderRadius: 1, cursor: 'pointer', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }, '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: 2 } }}
        >
          <CalendarClock size={16} />
          <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{upcomingItems.length}</Typography>
        </Box>
      </Tooltip>
      <Popover
        open={!!upcomingAnchor} anchorEl={upcomingAnchor} onClose={closeUpcoming}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ minWidth: 260, maxWidth: 340, maxHeight: 420, overflowY: 'auto', p: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, px: 0.5 }}>Upcoming{upcomingItems.length ? ` (${upcomingItems.length})` : ''}</Typography>
          {upcomingItems.length === 0 && <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>Nothing upcoming.</Typography>}
          {groupedUpcoming.map((g) => (
            <Box key={g.bucket} sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'text.secondary', px: 0.5, mt: 0.5 }}>{g.bucket}</Typography>
              {g.items.map((i) => (
                <Box
                  key={i.key} role="button" tabIndex={0} aria-label={`${i.type === 'deadline' ? 'Deadline' : 'Task'}: ${i.title}`}
                  onClick={() => gotoItem(i.type)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gotoItem(i.type) } }}
                  sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, px: 0.75, py: 0.4, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid var(--color-accent)' } }}
                >
                  <Box component="span" sx={{ color: i.type === 'deadline' ? 'error.main' : 'primary.main', fontWeight: 700, fontSize: 11 }}>{i.type === 'deadline' ? 'D' : 'T'}</Box>
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap>{i.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{friendly(i.when) || i.when}</Typography>
                </Box>
              ))}
            </Box>
          ))}
          {hiddenUpcoming > 0 && (
            <Box
              role="button" tabIndex={0} onClick={() => setUpcomingExpanded(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUpcomingExpanded(true) } }}
              sx={{ textAlign: 'center', py: 0.5, mt: 0.25, borderRadius: 1, cursor: 'pointer', color: 'primary.main', fontSize: 12, '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid var(--color-accent)' } }}
            >
              +{hiddenUpcoming} more
            </Box>
          )}
        </Box>
      </Popover>

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
