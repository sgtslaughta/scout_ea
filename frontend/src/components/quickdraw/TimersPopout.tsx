import { Box, Typography } from '@mui/material'
import { TimersPanel } from './TimersPanel'

export function TimersPopout() {
  return (
    <Box sx={{ p: 2, minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Timers</Typography>
      <TimersPanel showPopout={false} />
    </Box>
  )
}
