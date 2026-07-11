import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'
import { getPeople, addPerson, updatePerson, deletePerson, type Person } from '@/api'
import { toast } from 'sonner'
import { ActionMenu } from '@/components/actions/ActionMenu'

const IMPORTANCE_LEVELS = [
  { value: 1, label: 'Critical' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
  { value: 5, label: 'Very Low' },
]

const getImportanceColor = (importance: number): 'error' | 'warning' | 'info' => {
  if (importance === 1) return 'error'
  if (importance <= 3) return 'warning'
  return 'info'
}

export function PeopleView() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [org, setOrg] = useState('')
  const [importance, setImportance] = useState<number>(3)
  const [notes, setNotes] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null)

  const includeInactive = searchParams.get('include-inactive') === 'true'

  const { data: people = [], isLoading, error, refetch } = useQuery({
    queryKey: ['people', { includeInactive }],
    queryFn: () => getPeople(includeInactive),
  })

  const filteredPeople = includeInactive ? people : people.filter((p) => p.active === 1)

  const addMutation = useMutation({
    mutationFn: () =>
      addPerson({
        name,
        role: role || undefined,
        org: org || undefined,
        importance,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success(`Added ${name}`)
      queryClient.invalidateQueries({ queryKey: ['people'] })
      handleCloseDialog()
    },
    onError: () => toast.error('Failed to add person'),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePerson(editingId!, {
        name,
        role: role || undefined,
        org: org || undefined,
        importance,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success(`Updated ${name}`)
      queryClient.invalidateQueries({ queryKey: ['people'] })
      handleCloseDialog()
    },
    onError: () => toast.error('Failed to update person'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePerson(id),
    onSuccess: () => {
      toast.success(`Deactivated ${deletingPerson?.name}`)
      queryClient.invalidateQueries({ queryKey: ['people'] })
      setDeleteConfirmOpen(false)
      setDeletingPerson(null)
    },
    onError: () => toast.error('Failed to deactivate person'),
  })

  const handleAddSubmit = () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (editingId) {
      updateMutation.mutate()
    } else {
      addMutation.mutate()
    }
  }

  const handleCloseDialog = () => {
    setName('')
    setRole('')
    setOrg('')
    setImportance(3)
    setNotes('')
    setAddOpen(false)
    setEditingId(null)
  }

  const handleEdit = (person: Person) => {
    setName(person.name)
    setRole(person.role || '')
    setOrg(person.org || '')
    setImportance(person.importance || 3)
    setNotes(person.notes || '')
    setEditingId(person.id)
    setAddOpen(true)
  }

  const handleDeleteClick = (person: Person) => {
    setDeletingPerson(person)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (deletingPerson) {
      deleteMutation.mutate(deletingPerson.id)
    }
  }

  // DataGrid columns
  const columns: GridColDef<Person>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Tooltip
          title={params.row.notes || 'No notes'}
          arrow
        >
          <span>{params.row.name}</span>
        </Tooltip>
      ),
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
      renderCell: (params) => params.value || '—',
    },
    {
      field: 'org',
      headerName: 'Organization',
      width: 150,
      renderCell: (params) => params.value || '—',
    },
    {
      field: 'importance',
      headerName: 'Importance',
      width: 120,
      renderCell: (params) => (
        <Chip
          size="small"
          label={IMPORTANCE_LEVELS.find((l) => l.value === params.value)?.label}
          color={getImportanceColor(params.value)}
        />
      ),
    },
    {
      field: 'active',
      headerName: 'Status',
      width: 90,
      renderCell: (params) => (
        <Chip
          size="small"
          variant="outlined"
          label={params.row.active === 0 ? 'Inactive' : 'Active'}
          color={params.row.active === 0 ? 'default' : 'success'}
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      width: 120,
      getActions: (params) => [
        <GridActionsCellItem
          key="menu"
          icon={<ActionMenu entity={{ type: 'person', id: params.row.id }} />}
          label="Actions"
          showInMenu={false}
        />,
        <GridActionsCellItem
          key="edit"
          icon={<Pencil size={16} />}
          label="Edit"
          onClick={() => handleEdit(params.row as Person)}
          showInMenu={false}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<Trash2 size={16} />}
          label="Deactivate"
          onClick={() => handleDeleteClick(params.row as Person)}
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
          <Typography variant="h5">People</Typography>
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Switch
                checked={includeInactive}
                onChange={() =>
                  setSearchParams(
                    includeInactive ? {} : { 'include-inactive': 'true' }
                  )
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
            Add person
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
              Error loading people
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
          <DialogTitle>{editingId ? 'Edit person' : 'Add person'}</DialogTitle>
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
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              fullWidth
            />
            <TextField
              label="Organization"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              fullWidth
            />
            <Select
              label="Importance"
              value={importance}
              onChange={(e) => setImportance(e.target.value as number)}
              fullWidth
            >
              {IMPORTANCE_LEVELS.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  {level.value} - {level.label}
                </MenuItem>
              ))}
            </Select>
            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!name.trim()}
              onClick={handleAddSubmit}
              loading={addMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Save' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
          <DialogTitle>Deactivate {deletingPerson?.name}?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              This person will be marked inactive. You can restore them with the include-inactive filter.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              Deactivate
            </Button>
          </DialogActions>
        </Dialog>

        {/* Empty state or DataGrid */}
        {!isLoading && filteredPeople.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            {includeInactive ? 'No people yet.' : 'No active people. Enable include-inactive to see all.'}
          </Typography>
        ) : (
          <DataGrid
            rows={filteredPeople}
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
