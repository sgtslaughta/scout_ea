import { useQuery } from '@tanstack/react-query'
import { Box, Typography, Tooltip } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { Check, X } from 'lucide-react'
import { getActivity, type Activity } from '@/api'

export function ActivityView() {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['activity', 'all'], queryFn: () => getActivity(200), refetchInterval: 15000,
  })

  const columns: GridColDef<Activity>[] = [
    { field: 'status', headerName: '', width: 44, sortable: false, filterable: false,
      renderCell: (p) => p.row.status === 'error'
        ? <X size={15} aria-label="error" style={{ color: 'var(--mui-palette-error-main)' }} />
        : <Check size={15} aria-label="ok" style={{ color: 'var(--mui-palette-success-main)' }} /> },
    { field: 'skill', headerName: 'Skill', flex: 1,
      renderCell: (p) => <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{p.row.skill}</Typography> },
    { field: 'items_created', headerName: 'Items', width: 90, type: 'number' },
    { field: 'ran_at', headerName: 'Ran', width: 180,
      renderCell: (p) => <Typography variant="caption" color="text.secondary">{new Date(p.row.ran_at).toLocaleString()}</Typography> },
    { field: 'note', headerName: 'Note', flex: 1,
      renderCell: (p) => p.row.note
        ? <Tooltip title={p.row.note} arrow><span>{p.row.note}</span></Tooltip>
        : <Typography variant="caption" color="text.secondary">—</Typography> },
  ]

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Activity</Typography>
        {error && <Typography variant="body2" sx={{ color: 'error.main' }}>Error loading activity</Typography>}
        {!isLoading && rows.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No skill runs yet.</Typography>
        ) : (
          <DataGrid rows={rows} columns={columns} loading={isLoading} density="compact"
            disableColumnMenu pageSizeOptions={[25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'ran_at', sort: 'desc' }] },
            }} sx={{ border: 0 }} />
        )}
      </Box>
    </Box>
  )
}
