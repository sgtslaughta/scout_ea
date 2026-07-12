import { Box, Typography, Button, Chip } from '@mui/material'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { QuickdrawSection } from './QuickdrawSection'
import { useTimers } from '@/lib/useTimers'
import { formatClock } from '@/lib/timers'

const PRESETS = [5, 10, 25] // minutes
const DEFAULT_MS = 300_000

const clock = { fontFamily: '"JetBrains Mono", monospace', fontSize: 24, lineHeight: 1.2 } as const

export function TimersSection({ collapsed, onToggle }: { collapsed: boolean; onToggle: (id: string) => void }) {
  const t = useTimers()
  const running = (t.countdownRunning ? 1 : 0) + (t.stopwatchRunning ? 1 : 0)
  return (
    <QuickdrawSection id="timers" label="TIMERS" count={running} collapsed={collapsed} onToggle={onToggle} empty="" alwaysShowChildren>
      <Box sx={{ px: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Countdown */}
        <Box>
          <Typography variant="caption" color="text.secondary">Countdown</Typography>
          <Typography sx={clock}>{formatClock(t.remaining)}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, my: 0.5 }}>
            {PRESETS.map((m) => (
              <Chip key={m} size="small" label={`${m}m`} onClick={() => t.resetCountdown(m * 60_000)} aria-label={`set ${m} minutes`} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" startIcon={t.countdownRunning ? <Pause size={14} /> : <Play size={14} />}
              onClick={() => (t.countdownRunning ? t.pauseCountdown() : t.startCountdown())}>
              {t.countdownRunning ? 'Pause' : 'Start'}
            </Button>
            <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => t.resetCountdown(DEFAULT_MS)} aria-label="reset countdown">Reset</Button>
          </Box>
        </Box>
        {/* Stopwatch */}
        <Box>
          <Typography variant="caption" color="text.secondary">Stopwatch</Typography>
          <Typography sx={clock}>{formatClock(t.elapsed)}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Button size="small" startIcon={t.stopwatchRunning ? <Pause size={14} /> : <Play size={14} />}
              onClick={() => (t.stopwatchRunning ? t.pauseStopwatch() : t.startStopwatch())}>
              {t.stopwatchRunning ? 'Pause' : 'Start'}
            </Button>
            <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => t.resetStopwatch()} aria-label="reset stopwatch">Reset</Button>
          </Box>
        </Box>
      </Box>
    </QuickdrawSection>
  )
}
