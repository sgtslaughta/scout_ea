import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  Box,
  Typography,
  Stack,
  IconButton,
  Skeleton,
} from '@mui/material'
import { X } from 'lucide-react'
import { getBriefing, getWeather, getFinance } from '@/api'
import { WeatherBand } from './weather/WeatherBand'
import { SkyBackdrop } from './weather/SkyBackdrop'
import { CelestialArc } from './weather/CelestialArc'
import { ConditionFX } from './weather/ConditionFX'
import { useSkyPhase } from './weather/useSkyPhase'
import { arcFraction } from './weather/sky'
import { FinanceStrip } from './finance/FinanceStrip'
import { BriefingSections } from './briefing/BriefingSections'
import { useWeatherLocation } from '@/lib/useWeatherLocation'

interface TodayBriefingProps {
  open: boolean
  onClose: () => void
}

export function TodayBriefing({ open, onClose }: TodayBriefingProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  const { data: briefing, isLoading } = useQuery({
    queryKey: ['briefing'],
    queryFn: getBriefing,
    enabled: open,
  })

  const loc = useWeatherLocation(open)
  const { data: weather } = useQuery({
    queryKey: ['weather', loc?.lat, loc?.lon],
    queryFn: () => getWeather(loc!.lat, loc!.lon),
    enabled: open && !!loc,
  })

  const { data: finance } = useQuery({
    queryKey: ['finance'],
    queryFn: getFinance,
    enabled: open,
  })

  // Sky phase drives the whole modal background, not just the weather band —
  // the arc (sun/moon) now lives here too, spanning the full modal height.
  const { now, phase } = useSkyPhase(weather?.sunrise, weather?.sunset)

  // `weather.is_day` is a server-cached snapshot (30 min TTL) and disagrees with the
  // live clock near sunrise/sunset — derive night-ness from `phase` instead.
  const isNight = phase === 'night'
  const arcPos = useMemo(
    () => (weather?.sunrise && weather?.sunset
      ? arcFraction(now, weather.sunrise, weather.sunset, !isNight)
      : undefined),
    [now, weather?.sunrise, weather?.sunset, isNight],
  )

  const go = (view: string) => {
    onClose()
    navigate(view)
  }

  // Focus close button when modal opens
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth slotProps={{ paper: { sx: { position: 'relative', height: '92vh', m: 'auto', overflow: 'hidden' } } }}>
      {/* Pinned to the Paper (non-scrolling layer) so the sky stays behind
          below-the-fold content instead of scrolling away with it. */}
      <SkyBackdrop phase={phase} fade />
      {arcPos != null && <CelestialArc arcPos={arcPos} isNight={isNight} />}
      {weather && !weather.error && weather.condition && (
        <ConditionFX condition={weather.condition} isDay={weather.is_day ?? true} />
      )}
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', position: 'relative', zIndex: 1 }}>
        {/* Close button */}
        <IconButton
          ref={closeButtonRef}
          onClick={onClose}
          sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
          aria-label="Close briefing"
        >
          <X size={20} />
        </IconButton>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {/* Weather band */}
          {weather ? <Box sx={{ mb: 2 }}><WeatherBand weather={weather} /></Box> : <Box sx={{ height: 120, mb: 2 }} />}

          {/* Finance strip — horizontal, directly below weather */}
          {finance && <Box sx={{ mb: 3 }}><FinanceStrip finance={finance} /></Box>}

          {isLoading ? (
            <Stack spacing={2}>
              <Skeleton variant="text" height={40} />
              <Skeleton variant="rounded" height={200} />
              <Skeleton variant="rounded" height={200} />
            </Stack>
          ) : (
            <>
              {/* Summary headline */}
              {briefing?.summary && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {briefing.summary}
                  </Typography>
                </Box>
              )}

              {/* Grid of 4 section cards — ranked, scored, with context */}
              <BriefingSections briefing={briefing} onNavigate={go} />
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  )
}
