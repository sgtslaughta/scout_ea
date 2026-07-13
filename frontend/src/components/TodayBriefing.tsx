import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  Box,
  Typography,
  Stack,
  Paper,
  IconButton,
  Skeleton,
} from '@mui/material'
import { X } from 'lucide-react'
import { getBriefing } from '@/api'

interface TodayBriefingProps {
  open: boolean
  onClose: () => void
}

export function TodayBriefing({ open, onClose }: TodayBriefingProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const { data: briefing, isLoading } = useQuery({
    queryKey: ['briefing'],
    queryFn: getBriefing,
    enabled: open,
  })

  // Focus close button when modal opens
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} fullScreen slotProps={{ paper: { sx: { position: 'relative' } } }}>
      <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Close button */}
        <IconButton
          ref={closeButtonRef}
          onClick={onClose}
          sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
          aria-label="Close briefing"
        >
          <X size={20} />
        </IconButton>

        {/* Weather band placeholder */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            Weather — coming soon
          </Typography>
        </Box>

        {isLoading ? (
          <Stack spacing={2}>
            <Skeleton variant="text" height={40} />
            <Skeleton variant="rounded" height={200} />
            <Skeleton variant="rounded" height={200} />
          </Stack>
        ) : (
          <>
            {/* Summary headline */}
            {briefing?.summary && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {briefing.summary}
                </Typography>
              </Box>
            )}

            {/* Grid of 4 section cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
              {/* Critical Section */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  CRITICAL
                </Typography>
                {briefing?.critical && briefing.critical.length > 0 ? (
                  <Stack spacing={1}>
                    {briefing.critical.map((item) => (
                      <Typography key={item.id} variant="body2">
                        {item.title}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No critical items — clear morning
                  </Typography>
                )}
              </Paper>

              {/* Risks & Opportunities Section */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  RISKS & OPPORTUNITIES
                </Typography>
                {(briefing?.risks && briefing.risks.length > 0) || (briefing?.opportunities && briefing.opportunities.length > 0) ? (
                  <Stack spacing={1}>
                    {briefing?.risks?.map((item) => (
                      <Typography key={item.id} variant="body2">
                        {item.title}
                      </Typography>
                    ))}
                    {briefing?.opportunities?.map((item) => (
                      <Typography key={item.id} variant="body2">
                        {item.title}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Nothing flagged
                  </Typography>
                )}
              </Paper>

              {/* Topics News Section */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  TOPICS NEWS
                </Typography>
                {briefing?.news_by_topic && briefing.news_by_topic.length > 0 ? (
                  <Stack spacing={1}>
                    {briefing.news_by_topic.map((topic) =>
                      topic.items?.map((item) => (
                        <Typography key={item.id} variant="body2">
                          {item.title}
                        </Typography>
                      ))
                    )}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No topics today
                  </Typography>
                )}
              </Paper>

              {/* Key People Section */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  KEY PEOPLE
                </Typography>
                {briefing?.people && briefing.people.length > 0 ? (
                  <Stack spacing={1}>
                    {briefing.people.map((person) => (
                      <Typography key={person.id} variant="body2">
                        {person.name}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No key people
                  </Typography>
                )}
              </Paper>
            </Box>

            {/* Finance strip placeholder */}
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                Markets — coming soon
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  )
}
