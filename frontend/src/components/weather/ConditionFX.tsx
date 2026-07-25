import { Box } from '@mui/material'

export interface ConditionFXProps {
  condition: string
  isDay: boolean
}

/**
 * Weather condition effects (clouds, rain, snow, fog, storm) rendered at
 * modal level so they span the full modal width/height instead of being
 * boxed inside the 120px weather band.
 */
export function ConditionFX({ condition, isDay }: ConditionFXProps) {
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
            data-testid="cloud"
            sx={{
              position: 'absolute',
              top: '10%',
              left: '-15%',
              width: '80px',
              height: '30px',
              background: 'rgba(255, 255, 255, 0.4)',
              borderRadius: '20px',
              animation: 'driftClouds 22s linear infinite',
            }}
          />
          <Box
            data-testid="cloud"
            sx={{
              position: 'absolute',
              top: '35%',
              left: '-15%',
              width: '100px',
              height: '35px',
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '20px',
              animation: 'driftClouds 30s linear infinite',
              animationDelay: '-10s',
            }}
          />
          <Box
            data-testid="cloud"
            sx={{
              position: 'absolute',
              top: '55%',
              left: '-15%',
              width: '60px',
              height: '24px',
              background: 'rgba(255, 255, 255, 0.35)',
              borderRadius: '20px',
              animation: 'driftClouds 18s linear infinite',
              animationDelay: '-4s',
            }}
          />
        </>
      )}

      {condition === 'rain' && (
        <>
          <Box
            data-testid="cloud"
            sx={{
              position: 'absolute',
              top: '8%',
              left: '-15%',
              width: '60px',
              height: '25px',
              background: 'rgba(150, 150, 150, 0.5)',
              borderRadius: '15px',
              animation: 'driftClouds 26s linear infinite',
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
            data-testid="cloud"
            sx={{
              position: 'absolute',
              top: '6%',
              left: '-15%',
              width: '70px',
              height: '30px',
              background: 'rgba(60, 60, 80, 0.7)',
              borderRadius: '15px',
              animation: 'driftClouds 16s linear infinite',
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

      {/* Global animation keyframes */}
      <style>{`
        @keyframes driftClouds {
          0% { left: -15%; }
          100% { left: 115%; }
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
