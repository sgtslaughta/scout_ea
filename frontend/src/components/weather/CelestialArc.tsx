import { Box } from '@mui/material'

export interface CelestialArcProps {
  /** Position 0..1 across the arc (0 = left horizon, 1 = right horizon). */
  arcPos: number
  isNight: boolean
}

/**
 * The sun/moon's arc across the sky, rendered at modal level (full height)
 * rather than confined to the weather band's 120px strip.
 */
export function CelestialArc({ arcPos, isNight }: CelestialArcProps) {
  const celestialX = arcPos * 100
  const celestialY = 92 - Math.sin(arcPos * Math.PI) * 82

  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {/* Arc path (faint) */}
        <path d="M 0 92 Q 50 10 100 92" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.3" fill="none" />
        {/* Celestial body */}
        {!isNight ? (
          <circle
            cx={celestialX}
            cy={celestialY}
            r="3"
            fill="#fdb813"
            data-testid="celestial-sun"
            style={{ animation: 'celestialGlow 3s ease-in-out infinite' }}
          />
        ) : (
          <circle
            cx={celestialX}
            cy={celestialY}
            r="2.6"
            fill="#f5f5f5"
            data-testid="celestial-moon"
            style={{ animation: 'celestialGlow 3s ease-in-out infinite' }}
          />
        )}
      </svg>
      <style>{`
        @keyframes celestialGlow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.4)); }
          50% { filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.7)); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </Box>
  )
}
