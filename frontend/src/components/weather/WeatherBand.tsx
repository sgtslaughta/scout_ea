import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { WeatherResponse } from '@/api'
import { arcFraction } from './sky'
import { SkyBackdrop } from './SkyBackdrop'
import { useSkyPhase } from './useSkyPhase'

export interface WeatherBandProps {
  weather: WeatherResponse
  now?: Date
}

export function WeatherBand({ weather, now: nowProp }: WeatherBandProps) {
  // Live clock so the sun/moon advances across the arc in real time.
  // A fixed `now` prop (tests / controlled render) freezes it; otherwise tick each minute.
  const { now, phase } = useSkyPhase(weather.sunrise, weather.sunset, nowProp)

  // The gradient uses the live clock, so the celestial body must too — `weather.is_day`
  // is a server-cached snapshot (30 min TTL) and disagrees near sunrise/sunset.
  const isNight = phase === 'night'

  const arcPos = useMemo(
    () => arcFraction(now, weather.sunrise || new Date(), weather.sunset || new Date(), !isNight),
    [now, weather.sunrise, weather.sunset, isNight],
  )

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

  const celestialX = arcPos * 100
  const celestialY = 40 - Math.sin(arcPos * Math.PI) * 34

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
      {/* SkyBackdrop */}
      <SkyBackdrop phase={phase} />

      {/* CelestialArc */}
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* Arc path (faint) */}
        <path
          d="M 0 40 Q 50 6 100 40"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="0.5"
          fill="none"
        />
        {/* Celestial body */}
        {!isNight ? (
          <circle
            cx={celestialX}
            cy={celestialY}
            r="4"
            fill="#fdb813"
            data-testid="celestial-sun"
            style={{
              animation: 'celestialGlow 3s ease-in-out infinite',
            }}
          />
        ) : (
          <circle
            cx={celestialX}
            cy={celestialY}
            r="3.5"
            fill="#f5f5f5"
            data-testid="celestial-moon"
            style={{
              animation: 'celestialGlow 3s ease-in-out infinite',
            }}
          />
        )}
      </svg>

      {/* ConditionFX Layer */}
      <ConditionFX condition={weather.condition} isDay={weather.is_day ?? true} />

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

      {/* Forecast strip (next few days) */}
      {upcoming.length > 0 && (
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
              <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                {d.hi != null ? Math.round(d.hi) : '–'}°
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', opacity: 0.75 }}>
                {d.lo != null ? Math.round(d.lo) : '–'}°
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Global animation keyframes */}
      <style>{`
        @keyframes celestialGlow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.4)); }
          50% { filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.7)); }
        }
        @keyframes driftClouds {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes rainStreak {
          0% { transform: translateY(-120px); }
          100% { transform: translateY(120px); }
        }
        @keyframes driftSnow {
          0% { transform: translateX(-20px) translateY(-120px); }
          100% { transform: translateX(20px) translateY(120px); }
        }
        @keyframes fogPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes stormFlash {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.6; }
        }
        @keyframes sunRays {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes nightStars {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </Box>
  )
}

interface ConditionFXProps {
  condition: string
  isDay: boolean
}

function ConditionFX({ condition, isDay }: ConditionFXProps) {
  return (
    <Box
      data-testid={`condition-${condition}`}
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
      }}
    >
      {condition === 'clear' && isDay && (
        <svg
          viewBox="0 0 100 120"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <filter id="sunGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx="50"
            cy="30"
            r="8"
            fill="rgba(253, 184, 19, 0.2)"
            filter="url(#sunGlow)"
            style={{ animation: 'sunRays 4s ease-in-out infinite' }}
          />
        </svg>
      )}

      {condition === 'clear' && !isDay && (
        <svg
          viewBox="0 0 100 120"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <circle cx="20" cy="15" r="0.5" fill="#fff" opacity="0.7" style={{ animation: 'nightStars 2s ease-in-out infinite' }} />
          <circle cx="75" cy="25" r="0.4" fill="#fff" opacity="0.6" style={{ animation: 'nightStars 2.5s ease-in-out infinite' }} />
          <circle cx="85" cy="10" r="0.5" fill="#fff" opacity="0.8" style={{ animation: 'nightStars 3s ease-in-out infinite' }} />
          <circle cx="15" cy="40" r="0.4" fill="#fff" opacity="0.5" style={{ animation: 'nightStars 2.2s ease-in-out infinite' }} />
          <circle cx="90" cy="35" r="0.5" fill="#fff" opacity="0.7" style={{ animation: 'nightStars 2.8s ease-in-out infinite' }} />
        </svg>
      )}

      {condition === 'clouds' && (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: '20%',
              left: 0,
              width: '80px',
              height: '30px',
              background: 'rgba(255, 255, 255, 0.4)',
              borderRadius: '20px',
              animation: 'driftClouds 8s linear infinite',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '60%',
              right: 0,
              width: '100px',
              height: '35px',
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '20px',
              animation: 'driftClouds 10s linear infinite reverse',
              animationDelay: '2s',
            }}
          />
        </>
      )}

      {condition === 'rain' && (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: '10%',
              left: '10%',
              width: '60px',
              height: '25px',
              background: 'rgba(150, 150, 150, 0.5)',
              borderRadius: '15px',
              animation: 'driftClouds 10s linear infinite',
            }}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <Box
              key={`rain-${i}`}
              sx={{
                position: 'absolute',
                left: `${15 + i * 18}%`,
                top: 0,
                width: '2px',
                height: '60px',
                background: 'linear-gradient(180deg, transparent, rgba(200, 220, 240, 0.8))',
                animation: 'rainStreak 0.8s linear infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </>
      )}

      {condition === 'snow' && (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <Box
              key={`snow-${i}`}
              sx={{
                position: 'absolute',
                left: `${10 + i * 20}%`,
                top: '-10px',
                width: '4px',
                height: '4px',
                background: '#fff',
                borderRadius: '50%',
                animation: 'driftSnow 3s linear infinite',
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </>
      )}

      {condition === 'fog' && (
        <>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(200, 200, 200, 0.3), rgba(200, 200, 200, 0.5))',
              animation: 'fogPulse 4s ease-in-out infinite',
            }}
          />
        </>
      )}

      {condition === 'storm' && (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: '5%',
              left: '20%',
              width: '70px',
              height: '30px',
              background: 'rgba(60, 60, 80, 0.7)',
              borderRadius: '15px',
              animation: 'driftClouds 6s linear infinite',
            }}
          />
          {[0, 1, 2].map((i) => (
            <Box
              key={`storm-rain-${i}`}
              sx={{
                position: 'absolute',
                left: `${20 + i * 25}%`,
                top: '50px',
                width: '2px',
                height: '50px',
                background: 'linear-gradient(180deg, transparent, rgba(200, 220, 240, 0.9))',
                animation: 'rainStreak 0.6s linear infinite',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.05)',
              animation: 'stormFlash 1.5s ease-in-out infinite',
            }}
          />
        </>
      )}
    </Box>
  )
}
