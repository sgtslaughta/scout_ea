import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
} from '@mui/x-data-grid'
import { CheckCircle, Trash2, Edit2 } from 'lucide-react'
import { getTasks, setSignalStatus, updateTask, type Task } from '@/api'
import { toast } from 'sonner'

const statusFilters = ['open', 'in_progress', 'done', 'dismissed']
const PRIORITY_COLOR: Record<number, string> = { 1: 'error.main', 2: 'warning.main' }

export function TasksView() {
  const queryClient = useQueryClient()
  const theme = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeStatus, setActiveStatus] = useState('open')

  const { data: allTasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
    refetchInterval: 15000,
  })

  const dueToday = searchParams.get('due') === 'today'
  const dueTodayTasks = dueToday
    ? allTasks.filter((t) => t.due_at && new Date(t.due_at).toDateString() === new Date().toDateString())
    : allTasks

  const visibleTasks = activeStatus === 'all'
    ? dueTodayTasks
    : dueTodayTasks.filter((t) => t.status === activeStatus)

  const completeMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('tasks', id, 'done'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Completed')
    },
    onError: () => toast.error('Failed to complete'),
  })

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('tasks', id, 'dismissed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Dismissed')
    },
    onError: () => toast.error('Failed to dismiss'),
  })

  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [fTitle, setFTitle] = useState('')
  const [fDetail, setFDetail] = useState('')
  const [fDue, setFDue] = useState('')
  const [fPriority, setFPriority] = useState(3)
  const [fStatus, setFStatus] = useState('open')

  const updateMutation = useMutation({
    mutationFn: () => updateTask(editingId!, {
      title: fTitle.trim(), detail: fDetail.trim() || undefined,
      due_at: fDue ? new Date(fDue).toISOString() : undefined,
      priority: fPriority, status: fStatus,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task updated'); handleCloseEdit() },
    onError: () => toast.error('Failed to update task'),
  })

  const handleEdit = (t: Task) => {
    setEditingId(t.id); setFTitle(t.title); setFDetail(t.detail ?? '')
    setFDue(t.due_at ? new Date(t.due_at).toISOString().slice(0, 10) : '')
    setFPriority(t.priority); setFStatus(t.status); setEditOpen(true)
  }
  const handleCloseEdit = () => { setEditOpen(false); setEditingId(null) }

  const formatDueDate = (dueAt: string): string => {
    const dueDate = new Date(dueAt)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const isToday = dueDate.toDateString() === today.toDateString()
    const isTomorrow = dueDate.toDateString() === tomorrow.toDateString()

    return isToday
      ? 'Today'
      : isTomorrow
        ? 'Tomorrow'
        : dueDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
  }

  const getDueDateColor = (dueAt: string): string => {
    const dueDate = new Date(dueAt)
    const today = new Date()

    if (dueDate.toDateString() === today.toDateString()) {
      return theme.palette.warning.main
    }
    if (dueDate < today) {
      return theme.palette.error.main
    }
    return theme.palette.text.primary
  }

  const columns: GridColDef[] = [
    {
      field: 'priority',
      headerName: '',
      width: 36,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_COLOR[params.row.priority] ?? 'info.main' }} aria-label={`priority ${params.row.priority}`} />
      ),
    },
    {
      field: 'title',
      headerName: 'Task',
      flex: 1,
      renderCell: (params) => (
        <Tooltip
          title={`${params.row.title}${params.row.detail ? '\n' + params.row.detail : ''}`}
          arrow
        >
          <span>{params.row.title}</span>
        </Tooltip>
      ),
    },
    {
      field: 'due_at',
      headerName: 'Due',
      width: 100,
      renderCell: (params) => (
        <Typography
          variant="caption"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            color: getDueDateColor(params.value),
          }}
        >
          {formatDueDate(params.value)}
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
          label={params.row.status.replace('_', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          color={params.row.priority <= 1 ? 'error' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      width: 100,
      getActions: (params) => [
        <GridActionsCellItem
          key="edit" icon={<Edit2 size={16} />} label="Edit"
          onClick={() => handleEdit(params.row)} showInMenu={false} />,
        <GridActionsCellItem
          key="complete"
          icon={<CheckCircle size={16} />}
          label="Complete"
          onClick={() => completeMutation.mutate(params.row.id)}
          disabled={completeMutation.isPending}
          showInMenu={false}
        />,
        <GridActionsCellItem
          key="dismiss"
          icon={<Trash2 size={16} />}
          label="Dismiss"
          onClick={() => dismissMutation.mutate(params.row.id)}
          disabled={dismissMutation.isPending}
          showInMenu={false}
        />,
      ],
    },
  ]

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header */}
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          Tasks
        </Typography>

        {/* Drill-down due filter chip */}
        {dueToday && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Chip
              label="Due today"
              onDelete={() => setSearchParams({})}
              size="small"
            />
          </Box>
        )}

        {/* Status tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={activeStatus}
            onChange={(_, newVal) => setActiveStatus(newVal)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {statusFilters.map((status) => (
              <Tab
                key={status}
                label={status.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                value={status}
              />
            ))}
          </Tabs>
        </Box>

        {/* Error state */}
        {error && (
          <Box
            sx={{
              bgcolor: 'error.main',
              color: 'error.contrastText',
              p: 2,
              borderRadius: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2">Error loading tasks</Typography>
            <Typography
              variant="body2"
              component="button"
              onClick={() => refetch()}
              sx={{
                cursor: 'pointer',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                color: 'inherit',
                fontWeight: 600,
              }}
            >
              Retry
            </Typography>
          </Box>
        )}

        {/* Empty state */}
        {!isLoading && visibleTasks.length === 0 && (
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              p: 4,
              color: 'text.secondary',
            }}
          >
            No tasks yet. Create one to get started.
          </Typography>
        )}

        {/* DataGrid */}
        {visibleTasks.length > 0 && (
          <DataGrid
            rows={visibleTasks}
            columns={columns}
            loading={isLoading}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
            }}
            sx={{
              '& .MuiDataGrid-root': {
                border: 'none',
              },
              '& .MuiDataGrid-cell': {
                py: 1,
              },
            }}
          />
        )}

        <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="xs" fullWidth>
          <DialogTitle>Edit task</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Title" value={fTitle} onChange={(e) => setFTitle(e.target.value)} autoFocus required fullWidth />
            <TextField label="Detail" value={fDetail} onChange={(e) => setFDetail(e.target.value)} multiline rows={2} fullWidth />
            <TextField label="Due" type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Priority" select value={fPriority} onChange={(e) => setFPriority(Number(e.target.value))} required fullWidth slotProps={{ select: { native: true } }}>
              <option value={1}>1 - Critical</option>
              <option value={2}>2 - High</option>
              <option value={3}>3 - Normal</option>
            </TextField>
            <TextField label="Status" select value={fStatus} onChange={(e) => setFStatus(e.target.value)} required fullWidth slotProps={{ select: { native: true } }}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="dismissed">Dismissed</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit}>Cancel</Button>
            <Button variant="contained" disabled={!fTitle.trim()} onClick={() => updateMutation.mutate()}>Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  )
}
