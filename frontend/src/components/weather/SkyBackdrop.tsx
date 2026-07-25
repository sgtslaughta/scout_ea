import { Box } from '@mui/material'
import type { SkyPhase } from './sky'

/** Sky gradient presets by phase. Intentionally hardcoded — a sky is not a theme color. */
export const skyGradients: Record<SkyPhase, string> = {
  dawn: 'linear-gradient(180deg, #ffc2a6 0%, #ffb380 50%, #a8d8ff 100%)',
  day: 'linear-gradient(180deg, #87ceeb 0%, #e0f6ff 100%)',
  dusk: 'linear-gradient(180deg, #ff9a56 0%, #c66dd4 50%, #2a1b4d 100%)',
  night: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0d0a1a 100%)',
}

export interface SkyBackdropProps {
  phase: SkyPhase
  /** Fade the sky out toward the bottom, so content below sits on near-neutral ground. */
  fade?: boolean
}

// Keep the sky perceptible for the full modal height (never fully transparent) while
// dimming it toward the bottom so card text over the lower quadrants stays legible.
const FADE_MASK = 'linear-gradient(180deg, #000 0%, #000 45%, rgba(0,0,0,0.35) 100%)'

export function SkyBackdrop({ phase, fade = false }: SkyBackdropProps) {
  return (
    <Box
      aria-hidden
      data-testid="sky-backdrop"
      data-phase={phase}
      sx={(theme) => ({
        position: 'absolute',
        inset: 0,
        background: skyGradients[phase] || skyGradients.day,
        pointerEvents: 'none',
        ...(fade && { maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }),
        // Dark mode: the same sky at lower luminance — an overlay, not a second palette.
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundColor: theme.palette.common.black,
          opacity: 0,
          ...theme.applyStyles('dark', { opacity: 0.55 }),
        },
      })}
    />
  )
}
