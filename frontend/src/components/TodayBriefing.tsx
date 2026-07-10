import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  Box,
  Typography,
  Stack,
  Paper,
  IconButton,
  Button,
  Skeleton,
} from '@mui/material'
import { X, AlertCircle } from 'lucide-react'
import { getOutlook, getSignals } from '@/api'

interface TodayBriefingProps {
  open: boolean
  onClose: () => void
}

export function TodayBriefing({ open, onClose }: TodayBriefingProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const { data: outlook, isLoading: outlookLoading } = useQuery({
    queryKey: ['outlook'],
    queryFn: getOutlook,
    enabled: open,
  })

  const { data: triageSignals = [] } = useQuery({
    queryKey: ['signals', 'new'],
    queryFn: () => getSignals('new'),
    enabled: open && !outlookLoading,
  })

  const regularSignals = triageSignals.filter(s => s.type !== 'proactive')
  const proactiveSignals = outlook?.proactive || []
  const tasksToday = outlook?.tasks_due_today || []

  // Focus close button when modal opens
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { position: 'relative' } } }}>
      <Box sx={{ p: 3 }}>
        {/* Close button */}
        <IconButton
          ref={closeButtonRef}
          onClick={onClose}
          sx={{ position: 'absolute', top: 16, right: 16 }}
          aria-label="Close briefing"
        >
          <X size={20} />
        </IconButton>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
            TODAY'S BRIEFING
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Typography>
        </Box>

        {outlookLoading ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
          </Stack>
        ) : (
          <Stack spacing={3}>
            {/* Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              <Paper sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  MEETINGS
                </Typography>
                <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>
                  {outlook?.deadlines.length || 0}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  DUE TODAY
                </Typography>
                <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'success.main' }}>
                  {tasksToday.length}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  ACTIVE
                </Typography>
                <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'warning.main' }}>
                  {outlook?.deadlines.filter(d => d.countdown_seconds < 86400).length || 0}
                </Typography>
              </Paper>
            </Box>

            {/* Triaged Signals */}
            {regularSignals.length > 0 && (
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  SIGNALS
                </Typography>
                <Stack spacing={0.5}>
                  {regularSignals.slice(0, 5).map((sig) => (
                    <Box
                      key={sig.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 0.5,
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.selected' },
                      }}
                    >
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          flexShrink: 0,
                          bgcolor:
                            sig.priority <= 1
                              ? '#E5484D'
                              : sig.priority === 2
                                ? '#F2A65A'
                                : '#6C8FE5',
                        }}
                      />
                      <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sig.title}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

            {/* Proactive */}
            {proactiveSignals.length > 0 && (
              <Paper sx={{ p: 2, bgcolor: 'primary.light', borderColor: 'primary.light', borderWidth: 1, borderStyle: 'solid' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1, color: 'primary.main' }}>
                  PROACTIVE
                </Typography>
                <Stack spacing={0.5}>
                  {proactiveSignals.slice(0, 3).map((item) => (
                    <Box key={item.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-accent)' }} />
                      <Typography variant="caption">{item.title}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

            {/* CTA */}
            <Button
              onClick={onClose}
              fullWidth
              variant="contained"
              sx={{ py: 1, fontSize: '0.875rem' }}
            >
              Start my day
            </Button>
          </Stack>
        )}
      </Box>
    </Dialog>
  )
}
