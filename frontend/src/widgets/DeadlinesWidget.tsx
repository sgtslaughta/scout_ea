import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import { getDeadlines, type Deadline } from '@/api'
import { useWidgetCount } from './WidgetCard'

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'overdue'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 24) return `${Math.floor(h / 24)}d`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const columns: GridColDef<Deadline>[] = [
  {
    field: 'title',
    headerName: 'Deadline',
    flex: 1,
    renderCell: (p) => (
      <Tooltip
        title={
          <Box sx={{ p: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.row.title}</Typography>
            <Typography variant="caption">Due {new Date(p.row.due_at).toLocaleString()}</Typography>
            {p.row.detail && <Typography variant="caption" sx={{ display: 'block' }}>{p.row.detail}</Typography>}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>source: {p.row.source}</Typography>
          </Box>
        }
      >
        <span>{p.row.title}</span>
      </Tooltip>
    ),
  },
  {
    field: 'countdown_seconds',
    headerName: 'In',
    width: 90,
    renderCell: (p) => (
      <Typography
        variant="caption"
        sx={{ fontFamily: '"JetBrains Mono", monospace' }}
        color={p.value <= 0 ? 'error.main' : p.value < 86400 ? 'warning.main' : 'text.secondary'}
      >
        {formatCountdown(p.value)}
      </Typography>
    ),
  },
]

export default function DeadlinesWidget() {
  const { data = [], isLoading } = useQuery({ queryKey: ['deadlines'], queryFn: getDeadlines, refetchInterval: 15000 })
  const navigate = useNavigate()
  const rows = [...data].sort((a, b) => a.countdown_seconds - b.countdown_seconds)
  useWidgetCount(rows.length)

  if (!isLoading && rows.length === 0) {
    return <Typography variant="caption" color="text.secondary">No deadlines tracked.</Typography>
  }
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={isLoading}
      density="compact"
      hideFooter
      disableColumnMenu
      onRowClick={() => navigate('/deadlines')}
      sx={{ border: 0, cursor: 'pointer', maxHeight: 320 }}
    />
  )
}
