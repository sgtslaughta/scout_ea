import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Plus, Edit2 } from 'lucide-react'
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
import { getDeadlines, addDeadline, updateDeadline, setDeadlineVisible, setConfig, type Deadline, type DeadlineLink } from '@/api'
import { formatCountdown } from '@/widgets/DeadlinesWidget'
import { DeadlineRefsEditor } from '@/components/DeadlineRefsEditor'
import { useFriendlyTime } from '@/lib/timePrefs'
import { toast } from 'sonner'

const REF_ROUTE: Record<DeadlineLink['ref_type'], string> = { person: '/people', task: '/tasks', event: '/calendar' }

// datetime-local <-> ISO helpers (browser-local wall time).
const isoToLocalInput = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const localInputToISO = (v: string) => new Date(v).toISOString()

export function DeadlinesView() {
  const queryClient = useQueryClient()
  const friendly = useFriendlyTime()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [detail, setDetail] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  const { data: deadlines = [], isLoading, error, refetch } = useQuery({
    queryKey: ['deadlines', showHidden],
    queryFn: () => getDeadlines(showHidden),
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
    mutationFn: () => addDeadline(title, localInputToISO(dueAt), detail),
    onSuccess: () => {
      toast.success('Deadline added')
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      handleCloseDialog()
    },
    onError: () => toast.error('Failed to add deadline'),
  })

  const updateMutation = useMutation({
    mutationFn: () => updateDeadline(editingId!, { title, due_at: localInputToISO(dueAt), detail }),
    onSuccess: () => {
      toast.success('Deadline updated')
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      handleCloseDialog()
    },
    onError: () => toast.error('Failed to update deadline'),
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

  const handleSubmit = () => {
    if (!title.trim() || !dueAt) {
      toast.error('Title and due date required')
      return
    }
    ;(editingId ? updateMutation : addMutation).mutate()
  }

  const handleEdit = (d: Deadline) => {
    setEditingId(d.id); setTitle(d.title); setDetail(d.detail ?? ''); setDueAt(isoToLocalInput(d.due_at)); setAddOpen(true)
  }

  const handleCloseDialog = () => {
    setTitle('')
    setDueAt('')
    setDetail('')
    setEditingId(null)
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
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, opacity: params.row.visible ? 1 : 0.55 }}>
            {params.row.title}
            {!params.row.visible && <Chip size="small" variant="outlined" label="hidden" sx={{ height: 18, fontSize: 10 }} />}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'due_at',
      headerName: 'Due',
      flex: 1,
      minWidth: 240,
      renderCell: (params) => friendly(params.value),
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
      field: 'links',
      headerName: 'Refs',
      flex: 1,
      minWidth: 160,
      sortable: false,
      renderCell: (params) => {
        const links = params.row.links ?? []
        const tags = params.row.tags ?? []
        if (!links.length && !tags.length) return null
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', py: 0.5 }}>
            {links.map((l) => (
              <Chip
                key={`l${l.id}`} size="small" label={l.label}
                onClick={() => navigate(REF_ROUTE[l.ref_type])}
                sx={{ height: 20, fontSize: 10, cursor: 'pointer' }}
              />
            ))}
            {tags.map((t) => (
              <Chip key={`t${t.id}`} size="small" variant="outlined" label={t.tag} sx={{ height: 20, fontSize: 10 }} />
            ))}
          </Box>
        )
      },
    },
    {
      field: 'actions',
      type: 'actions',
      width: 90,
      getActions: (params) => [
        <GridActionsCellItem
          key="edit"
          icon={<Edit2 size={16} />}
          label="Edit"
          onClick={() => handleEdit(params.row)}
          showInMenu={false}
        />,
        <GridActionsCellItem
          key="toggle-visibility"
          icon={params.row.visible ? <Eye size={16} /> : <EyeOff size={16} />}
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
            control={<Switch checked={showHidden} onChange={() => setShowHidden((v) => !v)} />}
            label="Show hidden"
          />
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
            onClick={() => { setEditingId(null); setTitle(''); setDueAt(''); setDetail(''); setAddOpen(true) }}
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
          <DialogTitle>{editingId ? 'Edit deadline' : 'Add deadline'}</DialogTitle>
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
            {editingId && (() => {
              const editing = deadlines.find((d) => d.id === editingId)
              return editing ? <DeadlineRefsEditor deadline={editing} /> : null
            })()}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!title || !dueAt}
              onClick={handleSubmit}
            >
              {editingId ? 'Save' : 'Add'}
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
