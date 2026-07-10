import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Typography,
  Chip,
  Tooltip,
  Skeleton,
} from '@mui/material'
import { getEvents, setSignalStatus } from '@/api'
import { toast } from 'sonner'

export function CalendarView() {
  const queryClient = useQueryClient()

  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    refetchInterval: 15000,
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('events', id, 'approved'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success('Approved')
    },
    onError: () => toast.error('Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('events', id, 'rejected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success('Rejected')
    },
    onError: () => toast.error('Failed to reject'),
  })

  const parseJsonSafe = <T,>(json: string | undefined): T[] => {
    if (!json) return []
    try {
      return JSON.parse(json)
    } catch {
      return []
    }
  }

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header */}
        <Typography variant="h5" sx={{ mb: 2 }}>
          Calendar
        </Typography>

        {/* Error alert */}
        {error && (
          <Box
            sx={{
              bgcolor: 'error.main',
              opacity: 0.3,
              border: '1px solid',
              borderColor: 'error.main',
              borderRadius: 1,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              Error loading events
            </Typography>
            <Button
              size="small"
              onClick={() => refetch()}
              sx={{ color: 'error.main', textDecoration: 'underline' }}
            >
              Retry
            </Button>
          </Box>
        )}

        {/* Events list */}
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Skeleton variant="rounded" height={40} sx={{ mb: 1 }} />
            <Skeleton variant="rounded" height={40} sx={{ mb: 1 }} />
            <Skeleton variant="rounded" height={40} sx={{ mb: 1 }} />
          </Box>
        ) : events.length === 0 ? (
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 3,
              textAlign: 'center',
              color: 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            No events scheduled.
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {events.map((e) => {
              const proposedTimes = parseJsonSafe<string>(e.proposed_times)
              const attendeesList = parseJsonSafe<string>(e.attendees)
              const chosenTime = e.chosen_time

              return (
                <Box
                  key={e.id}
                  sx={{
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    transition: 'background-color 0.2s',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  {/* Event header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {e.title}
                      </Typography>
                      {e.body && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                          {e.body}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={e.status}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  {/* Event times and attendees */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
                    {chosenTime ? (
                      <Tooltip title={`Scheduled for ${chosenTime}`}>
                        <Chip
                          label={chosenTime}
                          size="small"
                          variant="filled"
                          color="primary"
                        />
                      </Tooltip>
                    ) : proposedTimes.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {proposedTimes.slice(0, 3).map((time, i) => (
                          <Tooltip key={i} title={`Proposed: ${time}`}>
                            <Chip
                              label={time}
                              size="small"
                              variant="outlined"
                            />
                          </Tooltip>
                        ))}
                        {proposedTimes.length > 3 && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                            +{proposedTimes.length - 3} more
                          </Typography>
                        )}
                      </Box>
                    ) : null}

                    {attendeesList.length > 0 && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {attendeesList.length} {attendeesList.length === 1 ? 'attendee' : 'attendees'}
                      </Typography>
                    )}
                  </Box>

                  {/* Action buttons */}
                  {e.status === 'suggested' && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => approveMutation.mutate(e.id)}
                        disabled={approveMutation.isPending}
                        sx={{ flex: 1 }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => rejectMutation.mutate(e.id)}
                        disabled={rejectMutation.isPending}
                        sx={{ flex: 1 }}
                      >
                        Reject
                      </Button>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
