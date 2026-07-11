import { Box } from '@mui/material'

export type TimelineItemType = 'deadline' | 'task' | 'event'

const LABEL: Record<TimelineItemType, string> = { deadline: 'Deadline', task: 'Task', event: 'Event' }
// Semantic palette per type: deadline=error (red), task=primary, event=success (green).
const HUE: Record<TimelineItemType, string> = { deadline: 'error', task: 'primary', event: 'success' }

/**
 * Small tinted pill marking a timeline item's type (deadline/task/event).
 * Theme-reactive via the palette *-mainChannel CSS vars (all 5 themes, light+dark).
 */
export function TimelineTypeChip({ type, dense }: { type: TimelineItemType; dense?: boolean }) {
  const hue = HUE[type]
  return (
    <Box
      component="span"
      aria-label={LABEL[type]}
      sx={{
        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
        px: dense ? 0.5 : 0.75, height: dense ? 15 : 17, borderRadius: 0.75,
        fontSize: dense ? 9 : 10, fontWeight: 700, lineHeight: 1, letterSpacing: 0.4,
        textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace',
        color: `${hue}.main`,
        bgcolor: `rgba(var(--mui-palette-${hue}-mainChannel) / 0.14)`,
        border: '1px solid', borderColor: `rgba(var(--mui-palette-${hue}-mainChannel) / 0.35)`,
      }}
    >
      {LABEL[type]}
    </Box>
  )
}
