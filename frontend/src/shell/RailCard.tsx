import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

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
      <Typography variant="h5" component="h2" sx={{ px: 2, py: 2.5 }}>
        {heading}
      </Typography>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 2 }}>{children}</Box>
    </Box>
  )
}
