import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Edit2, Plus, Trash2 } from 'lucide-react'
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
import { getTopics, addTopic, updateTopic, deleteTopic, type Topic } from '@/api'
import { toast } from 'sonner'

export function TopicsView() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(3)
  const [max_suggest, setMax_suggest] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null)

  const includeInactive = searchParams.get('include-inactive') === 'true'
  const { data: topics = [], isLoading, error, refetch } = useQuery({
    queryKey: ['topics', includeInactive],
    queryFn: () => getTopics(includeInactive),
  })

  const addMutation = useMutation({
    mutationFn: () =>
      addTopic({
        name: name.trim(),
        description: description.trim(),
        priority,
        max_suggest,
      }),
    onSuccess: () => {
      toast.success('Topic added')
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      handleCloseDialog()
    },
    onError: () => toast.error('Failed to add topic'),
  })
  const updateMutation = useMutation({
    mutationFn: () =>
      updateTopic(editingId!, {
        name: name.trim(),
        description: description.trim(),
        priority,
        max_suggest,
      }),
    onSuccess: () => {
      toast.success('Topic updated')
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      handleCloseDialog()
    },
    onError: () => toast.error('Failed to update topic'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTopic(id),
    onSuccess: () => {
      toast.success(`Deactivated ${deleteTarget?.name}`)
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to deactivate topic'),
  })
  const handleCloseDialog = () => {
    setName('')
    setDescription('')
    setPriority(3)
    setMax_suggest(1)
    setEditingId(null)
    setAddOpen(false)
  }
  const handleAddSubmit = () => {
    if (!name.trim() || max_suggest < 1) {
      toast.error('Name required, max_suggest must be >= 1')
      return
    }
    if (editingId) {
      updateMutation.mutate()
    } else {
      addMutation.mutate()
    }
  }
  const handleEdit = (topic: Topic) => {
    setName(topic.name)
    setDescription(topic.description || '')
    setPriority(topic.priority)
    setMax_suggest(topic.max_suggest)
    setEditingId(topic.id)
    setAddOpen(true)
  }
  const handleDeleteClick = (topic: Topic) => {
    setDeleteTarget(topic)
    setDeleteConfirmOpen(true)
  }
  const getPriorityColor = (p: number): 'error' | 'warning' | 'info' => {
    if (p === 1) return 'error'
    if (p <= 3) return 'warning'
    return 'info'
  }
  const columns: GridColDef<Topic>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      renderCell: (params) => (
        <Tooltip
          title={params.row.description || 'No description'}
          arrow
        >
          <span>{params.row.name}</span>
        </Tooltip>
      ),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 120,
      renderCell: (params) => {
        const labels = ['', 'Critical', 'High', 'Medium', 'Low', 'Very Low']
        return <Chip size="small" label={`${params.value} - ${labels[params.value]}`} color={getPriorityColor(params.value)} variant="outlined" />
      },
    },
    {
      field: 'max_suggest',
      headerName: 'Max Suggest',
      width: 120,
      type: 'number',
    },
    ...(includeInactive
      ? [
          {
            field: 'active',
            headerName: 'Status',
            width: 100,
            renderCell: (params: any) => (
              <Chip
                size="small"
                label={params.row.active ? 'Active' : 'Inactive'}
                color={params.row.active ? 'success' : 'default'}
                variant="outlined"
              />
            ),
          },
        ]
      : []),
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
          key="delete"
          icon={<Trash2 size={16} />}
          label="Deactivate"
          onClick={() => handleDeleteClick(params.row)}
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
          <Typography variant="h5">Topics</Typography>
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Switch
                checked={includeInactive}
                onChange={() =>
                  setSearchParams(includeInactive ? {} : { 'include-inactive': 'true' })
                }
              />
            }
            label="Include inactive"
          />
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setAddOpen(true)}
            size="small"
          >
            Add topic
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
              Error loading topics
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

        {/* Add/Edit dialog */}
        <Dialog open={addOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
          <DialogTitle>{editingId ? 'Edit topic' : 'Add topic'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              label="Priority"
              select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              required
              fullWidth
              slotProps={{ select: { native: true } }}
            >
              <option value={1}>1 - Critical</option>
              <option value={2}>2 - High</option>
              <option value={3}>3 - Medium</option>
              <option value={4}>4 - Low</option>
              <option value={5}>5 - Very Low</option>
            </TextField>
            <TextField
              label="Max Suggestions"
              type="number"
              value={max_suggest}
              onChange={(e) => setMax_suggest(Math.max(1, Number(e.target.value)))}
              required
              fullWidth
              slotProps={{ input: { inputProps: { min: 1 } } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!name.trim() || max_suggest < 1}
              onClick={handleAddSubmit}
            >
              {editingId ? 'Save' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
          <DialogTitle>Deactivate {deleteTarget?.name}?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              This topic will be deactivated and hidden from active lists.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Deactivate
            </Button>
          </DialogActions>
        </Dialog>

        {/* Empty state or DataGrid */}
        {!isLoading && topics.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No topics yet.
          </Typography>
        ) : (
          <DataGrid
            rows={topics}
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
