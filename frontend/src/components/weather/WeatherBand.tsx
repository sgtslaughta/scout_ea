import { Box, Typography } from '@mui/material'
import { Sun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning } from 'lucide-react'
import type { WeatherResponse, ForecastDay } from '@/api'

export interface WeatherBandProps {
  weather: WeatherResponse
}

const CONDITION_ICON: Record<ForecastDay['condition'], typeof Sun> = {
  clear: Sun,
  clouds: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  fog: CloudFog,
  storm: CloudLightning,
}

function ConditionGlyph({
  condition, size = 14, testId,
}: { condition: ForecastDay['condition']; size?: number; testId: string }) {
  const Icon = CONDITION_ICON[condition]
  return <Icon size={size} aria-label={condition} data-testid={testId} />
}

export function WeatherBand({ weather }: WeatherBandProps) {
  // Early return if error or missing condition
  if (weather.error || !weather.condition) {
    return (
      <Box
        sx={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: 2,
          backgroundColor: '#f0f0f0',
          color: '#999',
          borderRadius: 1,
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ color: '#999' }}>
            {weather.label || 'Location'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#ccc', fontStyle: 'italic' }}>
            Weather unavailable
          </Typography>
        </Box>
      </Box>
    )
  }

  const unit = weather.unit || 'C'
  const ariaLabel = `${weather.label}: ${weather.condition}, ${Math.round(weather.temp || 0)} degrees ${unit}`
  // forecast[0] is today; show the next few days
  const upcoming = (weather.forecast || []).slice(1, 4)

  return (
    <Box
      role="img"
      aria-label={ariaLabel}
      sx={{
        position: 'relative',
        height: 120,
        overflow: 'hidden',
        borderRadius: 1,
      }}
    >
      {/* Scrim — keeps white text legible against a bright daytime sky */}
      <Box
        aria-hidden
        data-testid="weather-scrim"
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 45%, transparent 75%)',
        }}
      />

      {/* Content Overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 10,
          color: '#fff',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
          {weather.label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <ConditionGlyph condition={weather.condition} size={20} testId="current-weather-glyph" />
          <Typography
            variant="body1"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              fontFamily: 'monospace',
            }}
          >
            {Math.round(weather.temp || 0)}°{unit}
          </Typography>
        </Box>
      </Box>

      {/* Forecast strip (next few days) */}
      {upcoming.length > 0 && (
        <>
          {/* Local scrim — the main scrim fades to transparent by 75% width, which
              leaves this bottom-right block unprotected against bright daytime skies. */}
          <Box
            aria-hidden
            data-testid="weather-forecast-scrim"
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'linear-gradient(270deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 30%, transparent 60%)',
            }}
          />
          <Box
            data-testid="weather-forecast"
            sx={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              zIndex: 10,
              display: 'flex',
              gap: 1.5,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
          {upcoming.map((d) => (
            <Box key={d.date} sx={{ textAlign: 'center', minWidth: 34 }}>
              <Typography sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 0.25 }}>
                <ConditionGlyph condition={d.condition} testId={`forecast-glyph-${d.date}`} />
              </Box>
              <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                {d.hi != null ? Math.round(d.hi) : '–'}°
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', opacity: 0.75 }}>
                {d.lo != null ? Math.round(d.lo) : '–'}°
              </Typography>
            </Box>
          ))}
          </Box>
        </>
      )}

    </Box>
  )
}
