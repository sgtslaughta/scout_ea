import { useState } from 'react'
import { Box, Typography, Button, Chip, IconButton, TextField, FormControlLabel, Checkbox, Tooltip } from '@mui/material'
import { Play, Pause, RotateCcw, X, BellOff, Plus, ExternalLink } from 'lucide-react'
import { useTimersContext } from '@/lib/useTimers'
import { formatClock } from '@/lib/timers'

const PRESETS = [1, 5, 10, 15, 25, 45, 60] // minutes
const clock = { fontFamily: '"JetBrains Mono", monospace', fontSize: 22, lineHeight: 1.2 } as const

export function TimersPanel({ showPopout = true }: { showPopout?: boolean }) {
  const t = useTimersContext()
  const [label, setLabel] = useState('')
  const [mins, setMins] = useState('')

  const addCustom = () => {
    const m = parseFloat(mins)
    if (!Number.isFinite(m) || m <= 0) return
    t.addTimer(label.trim(), Math.round(m * 60_000))
    setLabel(''); setMins('')
  }

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 260 }}>
      {/* Add row */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {PRESETS.map((m) => (
            <Chip key={m} size="small" label={`${m}m`} onClick={() => t.addTimer(label.trim(), m * 60_000)} aria-label={`set ${m} minutes`} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" label="Name" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ flex: 1 }} />
          <TextField size="small" label="custom minutes" value={mins} onChange={(e) => setMins(e.target.value)}
            slotProps={{ input: { inputMode: 'numeric' } }} sx={{ width: 72 }} />
          <Button size="small" variant="outlined" startIcon={<Plus size={14} />} onClick={addCustom} aria-label="add timer">Add</Button>
        </Box>
      </Box>

      {/* Timers */}
      {t.timers.map((tm) => (
        <Box key={tm.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: tm.ringing ? 'error.main' : 'action.hover' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap>{tm.label}</Typography>
            <Typography sx={{ ...clock, color: tm.ringing ? 'error.contrastText' : 'text.primary' }}>{formatClock(tm.remaining)}</Typography>
          </Box>
          {tm.ringing ? (
            <Button size="small" color="inherit" startIcon={<BellOff size={14} />} onClick={() => t.dismissAlarm(tm.id)}>Dismiss</Button>
          ) : (
            <>
              <Tooltip title={tm.running ? 'Pause' : 'Start'}><IconButton size="small" aria-label={tm.running ? `pause ${tm.label}` : `start ${tm.label}`} onClick={() => (tm.running ? t.pauseTimer(tm.id) : t.startTimer(tm.id))}>{tm.running ? <Pause size={16} /> : <Play size={16} />}</IconButton></Tooltip>
              <Tooltip title="Reset"><IconButton size="small" aria-label={`reset ${tm.label}`} onClick={() => t.resetTimer(tm.id)}><RotateCcw size={16} /></IconButton></Tooltip>
            </>
          )}
          <Tooltip title="Remove"><IconButton size="small" aria-label={`remove ${tm.label}`} onClick={() => t.removeTimer(tm.id)}><X size={16} /></IconButton></Tooltip>
        </Box>
      ))}

      {/* Stopwatch */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Stopwatch</Typography>
          <Typography sx={clock}>{formatClock(t.stopwatch.elapsed)}</Typography>
        </Box>
        <IconButton size="small" aria-label={t.stopwatch.running ? 'pause stopwatch' : 'start stopwatch'} onClick={() => (t.stopwatch.running ? t.pauseStopwatch() : t.startStopwatch())}>{t.stopwatch.running ? <Pause size={16} /> : <Play size={16} />}</IconButton>
        <IconButton size="small" aria-label="reset stopwatch" onClick={() => t.resetStopwatch()}><RotateCcw size={16} /></IconButton>
      </Box>

      {/* Settings + popout */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <FormControlLabel
          control={<Checkbox size="small" slotProps={{ input: { 'aria-label': 'continuous alarm' } }} checked={t.continuousAlarm} onChange={(e) => t.setContinuousAlarm(e.target.checked)} />}
          label="Continuous alarm"
        />
        {showPopout && (
          <Button size="small" startIcon={<ExternalLink size={14} />} onClick={() => window.open('/timers', 'ea-timers', 'width=420,height=640')}>Popout</Button>
        )}
      </Box>
    </Box>
  )
}
