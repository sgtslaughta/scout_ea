import { useQuery } from '@tanstack/react-query'
import { getSkills, type Skill } from '@/api'
import { Copy, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Box, Typography, Paper, CircularProgress, useTheme, Button, Tooltip } from '@mui/material'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'

export function DocsView() {
  const theme = useTheme()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['skills'], queryFn: getSkills })

  const copySkill = (name: string, body: string) => {
    navigator.clipboard.writeText(body)
    toast.success(`Copied ${name}`)
  }

  const columns: GridColDef<Skill>[] = [
    { field: 'name', headerName: 'Skill', width: 220,
      renderCell: (p) => <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.row.name}</Typography> },
    { field: 'description', headerName: 'Description', flex: 1,
      renderCell: (p) => <Tooltip title={p.row.description || 'No description'} arrow><span>{p.row.description}</span></Tooltip> },
    { field: 'schedule', headerName: 'Schedule', width: 160,
      renderCell: (p) => p.row.schedule
        ? <Box component="span" sx={{ px: 1, py: 0.5, bgcolor: 'action.hover', border: `1px solid ${theme.palette.divider}`, borderRadius: 0.5, fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>{p.row.schedule}</Box>
        : <Typography variant="caption" color="text.secondary">—</Typography> },
    { field: 'actions', type: 'actions', width: 70,
      getActions: (p) => [
        <GridActionsCellItem key="copy" icon={<Copy size={16} />} label={`Copy ${p.row.name} to clipboard`}
          onClick={() => copySkill(p.row.name, p.row.body)} showInMenu={false} />,
      ] },
  ]

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>Skills Library</Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Paste these automations into Microsoft Scout to install them.
          </Typography>
        </Paper>
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 12 }}><CircularProgress size={24} /></Box>
        )}
        {error && !isLoading && (
          <Box sx={{ display: 'flex', gap: 1.5, p: 2, alignItems: 'flex-start' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Failed to load skills</Typography>
              <Button variant="outlined" size="small" onClick={() => refetch()} sx={{ textDecoration: 'underline', textTransform: 'none', mt: 0.5 }}>Try again</Button>
            </Box>
          </Box>
        )}
        {!isLoading && !error && (!data || data.length === 0) && (
          <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', py: 12 }}>
            No skills yet. Create one to get started.
          </Typography>
        )}
        {data && data.length > 0 && (
          <DataGrid rows={data} columns={columns} getRowId={(r) => r.name} density="compact"
            rowHeight={48} columnHeaderHeight={44} disableColumnMenu pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} sx={{ border: 0 }} />
        )}
      </Box>
    </Box>
  )
}
