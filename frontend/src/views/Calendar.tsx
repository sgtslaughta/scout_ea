import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Typography, Chip, Tooltip, Skeleton } from '@mui/material'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'
import { Check, X } from 'lucide-react'
import { getEvents, setSignalStatus, type EventItem } from '@/api'
import { useFriendlyTime } from '@/lib/timePrefs'
import { toast } from 'sonner'

export function CalendarView() {
  const queryClient = useQueryClient()
  const friendly = useFriendlyTime()

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
    try { return JSON.parse(json) } catch { return [] }
  }

  const detailTip = (e: EventItem) => {
    const times = parseJsonSafe<string>(e.proposed_times)
    const attendees = parseJsonSafe<string>(e.attendees)
    const lines: string[] = []
    if (e.body) lines.push(e.body)
    if (!e.chosen_time && times.length) lines.push('Proposed: ' + times.slice(0, 3).map((t) => friendly(t) || t).join(', ') + (times.length > 3 ? ` +${times.length - 3} more` : ''))
    if (attendees.length) lines.push(`${attendees.length} ${attendees.length === 1 ? 'attendee' : 'attendees'}`)
    return lines.join('\n') || 'No details'
  }

  const columns: GridColDef<EventItem>[] = [
    {
      field: 'title', headerName: 'Event', flex: 1,
      renderCell: (p) => (
        <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{detailTip(p.row)}</span>} arrow>
          <span>{p.row.title}</span>
        </Tooltip>
      ),
    },
    {
      field: 'chosen_time', headerName: 'Time', flex: 1, minWidth: 240,
      renderCell: (p) => p.row.chosen_time
        ? <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500 }}>{friendly(p.row.chosen_time) || p.row.chosen_time}</Typography>
        : <Typography variant="caption" color="text.secondary">Unscheduled</Typography>,
    },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <Chip size="small" variant="outlined" label={p.row.status} />,
    },
    {
      field: 'actions', type: 'actions', width: 90,
      getActions: (p) => p.row.status === 'suggested' ? [
        <GridActionsCellItem key="approve" icon={<Check size={16} />} label="Approve"
          onClick={() => approveMutation.mutate(p.row.id)} disabled={approveMutation.isPending} showInMenu={false} />,
        <GridActionsCellItem key="reject" icon={<X size={16} />} label="Reject"
          onClick={() => rejectMutation.mutate(p.row.id)} disabled={rejectMutation.isPending} showInMenu={false} />,
      ] : [],
    },
  ]

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Calendar</Typography>
        {error && (
          <Box sx={{ bgcolor: 'error.main', opacity: 0.3, border: '1px solid', borderColor: 'error.main', borderRadius: 1, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'error.main' }}>Error loading events</Typography>
            <Button size="small" onClick={() => refetch()} sx={{ color: 'error.main', textDecoration: 'underline' }}>Retry</Button>
          </Box>
        )}
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Skeleton variant="rounded" height={40} /><Skeleton variant="rounded" height={40} /><Skeleton variant="rounded" height={40} />
          </Box>
        ) : events.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No events scheduled.</Typography>
        ) : (
          <DataGrid rows={events} columns={columns} loading={isLoading} density="compact"
            disableColumnMenu pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} sx={{ border: 0 }} />
        )}
      </Box>
    </Box>
  )
}
