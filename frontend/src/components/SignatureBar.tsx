import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { useColorScheme } from '@mui/material/styles'
import { Sun, Moon, Sparkles, Search, CalendarClock } from 'lucide-react'
import { getDeadlines, getEvents } from '@/api'
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

export function SignatureBar({ onCommandOpen, onOpenBriefing }: SignatureBarProps) {
  const [time, setTime] = useState(new Date())
  const { mode, systemMode, setMode } = useColorScheme()
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'dark'
  const navigate = useNavigate()
  const friendly = useFriendlyTime()
  const clock = useClockFormat()

  const { data: deadlines = [] } = useQuery({
    queryKey: ['deadlines'], queryFn: getDeadlines, refetchInterval: 15000,
  })
  const { data: events = [] } = useQuery({
    queryKey: ['events'], queryFn: getEvents, refetchInterval: 15000,
  })
  const upcoming = events
    .filter((e) => e.chosen_time && new Date(e.chosen_time).getTime() >= Date.now())
    .sort((a, b) => (a.chosen_time ?? '').localeCompare(b.chosen_time ?? ''))

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const nowPercent = clockPercent(time)
  const { onAxis, later } = bucketDeadlines(deadlines, time)

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

        {/* later overflow cluster */}
        {later.length > 0 && (
          <Tooltip arrow title={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Later ({later.length})</Typography>
              {later.slice(0, 6).map((d) => (
                <Typography key={d.id} variant="caption" sx={{ display: 'block' }}>{d.title} — {friendly(d.due_at)}</Typography>
              ))}
              {later.length > 6 && <Typography variant="caption" color="text.secondary">+{later.length - 6} more</Typography>}
            </Box>
          }>
            <Box
              role="button" tabIndex={0} aria-label={`${later.length} later deadlines`}
              onClick={() => navigate('/deadlines')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/deadlines') } }}
              sx={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: '1px', borderRadius: 1, cursor: 'pointer', bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' }, '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: 2 } }}
            >
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'text.secondary' }} />
              <Typography sx={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: 'text.secondary' }}>+{later.length}</Typography>
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* upcoming events indicator (fills the ~10% freed from the horizon) */}
      <Tooltip arrow title={
        <Box sx={{ p: 0.5, maxWidth: 260 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Upcoming events{upcoming.length ? ` (${upcoming.length})` : ''}</Typography>
          {upcoming.length === 0 && <Typography variant="caption" color="text.secondary">Nothing scheduled.</Typography>}
          {upcoming.slice(0, 6).map((e) => (
            <Typography key={e.id} variant="caption" sx={{ display: 'block' }}>{e.title} — {friendly(e.chosen_time) || e.chosen_time}</Typography>
          ))}
          {upcoming.length > 6 && <Typography variant="caption" color="text.secondary">+{upcoming.length - 6} more</Typography>}
        </Box>
      }>
        <Box
          role="button" tabIndex={0} aria-label={`${upcoming.length} upcoming events`}
          onClick={() => navigate('/calendar')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/calendar') } }}
          sx={{ flex: 1, minWidth: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, borderRadius: 1, cursor: 'pointer', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }, '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: 2 } }}
        >
          <CalendarClock size={16} />
          <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{upcoming.length}</Typography>
        </Box>
      </Tooltip>

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
