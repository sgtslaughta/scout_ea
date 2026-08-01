import Typography from '@mui/material/Typography'
import { RailCard } from './RailCard'

// TODO(calendar-feed sub-project): render the real list of meetings here.
export function LeftRail() {
  return (
    <RailCard heading="Calendar">
      <Typography variant="body1" color="text.secondary">
        Nothing on the calendar today.
      </Typography>
    </RailCard>
  )
}
