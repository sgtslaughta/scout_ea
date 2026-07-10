import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Eye, Plus } from 'lucide-react'
import {
  Box,
  Typography,
  FormControlLabel,
  Switch,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from '@mui/material'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'
import { getDeadlines, addDeadline, setDeadlineVisible, setConfig, type Deadline } from '@/api'
import { formatCountdown } from '@/widgets/DeadlinesWidget'
import { toast } from 'sonner'


export function DeadlinesView() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [detail, setDetail] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const { data: deadlines = [], isLoading, error, refetch } = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  const urgentOnly = searchParams.get('due') === '24h'
  const visibleDeadlines = urgentOnly
    ? deadlines.filter((d) => d.countdown_seconds < 86400)
    : deadlines

  const { data: config = {} } = useQuery({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then((r) => r.json()),
  })

  const addMutation = useMutation({
    mutationFn: () => addDeadline(title, dueAt, detail),
    onSuccess: () => {
      toast.success('Deadline added')
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      setTitle('')
      setDueAt('')
      setDetail('')
      setAddOpen(false)
    },
    onError: () => toast.error('Failed to add deadline'),
  })

  const visibilityMutation = useMutation({
    mutationFn: (vars: { id: number; visible: boolean }) =>
      setDeadlineVisible(vars.id, vars.visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
    },
    onError: () => toast.error('Failed to update visibility'),
  })

  const globalToggleMutation = useMutation({
    mutationFn: (value: string) => setConfig('deadlines_visible_global', value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      toast.success('Global deadlines toggle updated')
    },
  })

  const globalEnabled = config.deadlines_visible_global !== '0'

  const handleAddSubmit = () => {
    if (!title.trim() || !dueAt) {
      toast.error('Title and due date required')
      return
    }
    addMutation.mutate()
  }

  const handleCloseDialog = () => {
    setTitle('')
    setDueAt('')
    setDetail('')
    setAddOpen(false)
  }

  // DataGrid columns
  const columns: GridColDef<Deadline>[] = [
    {
      field: 'title',
      headerName: 'Deadline',
      flex: 1,
      renderCell: (params) => (
        <Tooltip
          title={`${params.row.title}${params.row.detail ? '\n' + params.row.detail : ''}\nSource: ${params.row.source}`}
          arrow
        >
          <span>{params.row.title}</span>
        </Tooltip>
      ),
    },
    {
      field: 'due_at',
      headerName: 'Due',
      width: 170,
      renderCell: (params) => new Date(params.value).toLocaleString(),
    },
    {
      field: 'countdown_seconds',
      headerName: 'In',
      width: 100,
      renderCell: (params) => (
        <Typography
          variant="caption"
          sx={{ fontFamily: '"JetBrains Mono", monospace' }}
          color={params.value <= 0 ? 'error.main' : params.value < 86400 ? 'warning.main' : 'text.secondary'}
        >
          {formatCountdown(params.value)}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params) => (
        <Chip
          size="small"
          variant="outlined"
          label={params.row.source}
          color={params.row.countdown_seconds <= 0 ? 'error' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      width: 70,
      getActions: (params) => [
        <GridActionsCellItem
          key="toggle-visibility"
          icon={<Eye size={16} />}
          label={params.row.visible ? 'Hide deadline' : 'Show deadline'}
          onClick={() =>
            visibilityMutation.mutate({ id: params.row.id, visible: !params.row.visible })
          }
          showInMenu={false}
        />,
      ],
    },
  ]

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h5">Deadlines</Typography>
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Switch
                checked={globalEnabled}
                onChange={() =>
                  globalToggleMutation.mutate(globalEnabled ? '0' : '1')
                }
              />
            }
            label="Show all deadlines"
          />
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setAddOpen(true)}
            size="small"
          >
            Add deadline
          </Button>
        </Box>

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
              Error loading deadlines
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

        {/* Global toggle off warning */}
        {!globalEnabled && (
          <Box
            sx={{
              bgcolor: 'warning.main',
              opacity: 0.1,
              border: '1px solid',
              borderColor: 'warning.main',
              borderRadius: 1,
              p: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: 'warning.main' }}>
              Global deadline toggle is off. Turn it on above to see all deadlines.
            </Typography>
          </Box>
        )}

        {/* Due <24h filter chip */}
        {urgentOnly && (
          <Box>
            <Chip
              label="Due <24h"
              onDelete={() => setSearchParams({})}
              size="small"
            />
          </Box>
        )}

        {/* Add deadline dialog */}
        <Dialog open={addOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
          <DialogTitle>Add deadline</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              fullWidth
            />
            <TextField
              label="Due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!title || !dueAt}
              onClick={handleAddSubmit}
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Empty state or DataGrid */}
        {!isLoading && visibleDeadlines.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No deadlines yet.</Typography>
        ) : (
          <DataGrid
            rows={visibleDeadlines}
            columns={columns}
            loading={isLoading}
            density="compact"
            disableColumnMenu
            pageSizeOptions={[25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            sx={{ border: 0 }}
          />
        )}
      </Box>
    </Box>
  )
}
