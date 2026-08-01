import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { useQuery } from '@tanstack/react-query'
import { getEvents, type EventItem } from '@/api'
import { useClockFormat } from '@/lib/timePrefs'
import { RailCard } from './RailCard'
import { teamsJoinUrl } from './teamsJoinUrl'

// Upcoming, chosen-time meetings only — proposals awaiting a chosen_time
// aren't "on the calendar" yet, so they don't belong in this rail.
function upcomingEvents(events: EventItem[], now: Date): EventItem[] {
  return events
    .filter((e) => e.chosen_time && new Date(e.chosen_time) >= now)
    .sort((a, b) => new Date(a.chosen_time!).getTime() - new Date(b.chosen_time!).getTime())
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

function MeetingRow({ event }: { event: EventItem }) {
  const clock = useClockFormat()
  const joinUrl = teamsJoinUrl(event)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        sx={{
          fontFamily: '"JetBrains Mono", monospace',
          fontVariantNumeric: 'tabular-nums',
          fontSize: '1rem',
          color: 'text.secondary',
          flexShrink: 0,
        }}
      >
        {clock(event.chosen_time)}
      </Typography>
      <Typography variant="body1" sx={{ flex: 1 }}>
        {event.title}
      </Typography>
      {joinUrl && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => window.open(joinUrl, '_blank', 'noopener')}
        >
          Join
        </Button>
      )}
    </Box>
  )
}

export function LeftRail() {
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: getEvents, refetchInterval: 15000 })
  const upcoming = upcomingEvents(events, new Date())

  let lastDay = ''

  return (
    <RailCard heading="Calendar">
      {upcoming.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          Nothing on the calendar today.
        </Typography>
      ) : (
        upcoming.map((event) => {
          const day = dayLabel(event.chosen_time!)
          const showDayHeading = day !== lastDay && upcoming.some((e) => dayLabel(e.chosen_time!) !== day)
          lastDay = day
          return (
            <Box key={event.id}>
              {showDayHeading && (
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', pt: 1 }}>
                  {day}
                </Typography>
              )}
              <MeetingRow event={event} />
            </Box>
          )
        })
      )}
    </RailCard>
  )
}
