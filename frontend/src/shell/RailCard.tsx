import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

interface RailCardProps {
  heading: string
  children: ReactNode
}

// Shared chrome for the left/right side rails: fixed width, own scroll,
// a heading, and a scrollable body that later agents fill with real content.
export function RailCard({ heading, children }: RailCardProps) {
  return (
    <Box
      sx={{
        width: 320,
        maxWidth: '100%',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Same accent-bar + tinted band as the tile headers, so the rails and
          the grid read as one surface under whichever theme is active. */}
      <Box
        sx={(t) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 2.5,
          background: t.vars
            ? `linear-gradient(180deg, rgba(${t.vars.palette.primary.mainChannel} / 0.07), rgba(${t.vars.palette.primary.mainChannel} / 0))`
            : `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.07)}, transparent)`,
          borderBottom: '1px solid',
          borderColor: t.vars
            ? `rgba(${t.vars.palette.primary.mainChannel} / 0.22)`
            : alpha(t.palette.primary.main, 0.22),
        })}
      >
        <Box aria-hidden sx={{ width: 3, height: 20, borderRadius: 1, bgcolor: 'primary.main', flexShrink: 0 }} />
        <Typography variant="h5" component="h2">
          {heading}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 2 }}>{children}</Box>
    </Box>
  )
}
