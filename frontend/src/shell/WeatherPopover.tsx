import Box from '@mui/material/Box'
import Popover from '@mui/material/Popover'
import Typography from '@mui/material/Typography'
import type { WeatherResponse } from '@/api'
import { CONDITION_ICON } from './TopBar'

export interface WeatherPopoverProps {
  weather: WeatherResponse
  label: string
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  /** Called when the pointer enters the popover paper — lets the caller
   *  cancel a pending close-on-leave timer scheduled from the anchor. */
  onPaperEnter?: () => void
}

const tempFmt = (v: number | null | undefined, unit: string) => (v == null ? '—' : `${Math.round(v)}°${unit}`)

/** Hover/focus popover for the top-bar weather readout: location + 5-day forecast. */
export function WeatherPopover({ weather, label, anchorEl, open, onClose, onPaperEnter }: WeatherPopoverProps) {
  const forecast = weather.forecast ?? []
  const today = forecast[0]
  const unit = weather.unit || 'C'

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          onMouseEnter: onPaperEnter,
          onMouseLeave: onClose,
          sx: { pointerEvents: 'auto', p: 2, minWidth: 260 },
        },
      }}
      disableRestoreFocus
    >
      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 0.5 }}>{label}</Typography>
      {today && (
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>
          Today{' '}
          <Box
            component="span"
            sx={{ fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'text.primary' }}
          >
            {tempFmt(today.hi, unit)} / {tempFmt(today.lo, unit)}
          </Box>
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {forecast.map((day) => {
          const Icon = CONDITION_ICON[day.condition]
          const dayName = new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })
          return (
            <Box key={day.date} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ width: 40, color: 'text.secondary' }}>{dayName}</Typography>
              <Icon size={20} role="img" aria-label={day.condition} />
              <Box sx={{ flex: 1 }} />
              <Typography
                sx={{ fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums' }}
              >
                {tempFmt(day.hi, unit)} / {tempFmt(day.lo, unit)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Popover>
  )
}
