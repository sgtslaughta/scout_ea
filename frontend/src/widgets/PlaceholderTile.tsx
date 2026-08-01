import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useWidgetCount } from './WidgetCard'

/**
 * Shared stand-in for dashboard tiles whose data source isn't wired up yet.
 * Reports a count of 0 so WidgetCard's central empty-state (icon + message
 * from the widget's `emptyState` def) takes over rendering.
 */
export default function PlaceholderTile() {
  useWidgetCount(0)
  return (
    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="body1" color="text.secondary">
        Nothing here yet — Scout will fill this in.
      </Typography>
    </Box>
  )
}
