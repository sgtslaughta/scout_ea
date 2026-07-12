import { Box, Chip, IconButton, Tooltip } from '@mui/material'
import { Timer as TimerIcon, Play, Pause } from 'lucide-react'
import { useTimersContext } from '@/lib/useTimers'
import { formatClock } from '@/lib/timers'

export function TimerPills({ onOpen }: { onOpen: () => void }) {
  const t = useTimersContext()
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}>
      <Tooltip title="Open timers"><IconButton size="small" aria-label="Timers" onClick={onOpen}><TimerIcon size={16} /></IconButton></Tooltip>
      {t.timers.map((tm) => (
        <Chip
          key={tm.id} size="small"
          color={tm.ringing ? 'error' : 'default'}
          variant={tm.ringing ? 'filled' : 'outlined'}
          onClick={() => (tm.ringing ? t.dismissAlarm(tm.id) : tm.running ? t.pauseTimer(tm.id) : t.startTimer(tm.id))}
          icon={tm.running ? <Pause size={12} /> : <Play size={12} />}
          label={`${tm.label} ${formatClock(tm.remaining)}`}
          aria-label={`${tm.label} ${tm.ringing ? 'dismiss' : tm.running ? 'pause' : 'start'}`}
        />
      ))}
    </Box>
  )
}
