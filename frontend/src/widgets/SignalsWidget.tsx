import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo } from 'react'
import { getSignals, type Signal } from '@/api'
import { useFriendlyTime } from '@/lib/timePrefs'
import { useWidgetCount } from './WidgetCard'

export function relativeTime(isoStr: string, now = new Date()): string {
  const diff = Math.floor((now.getTime() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const PRIORITY_COLOR: Record<number, string> = { 1: 'error.main', 2: 'warning.main' }

const makeColumns = (friendly: (iso: string) => string): GridColDef<Signal>[] => [
  {
    field: 'priority',
    headerName: '',
    width: 36,
    renderCell: (p) => (
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_COLOR[p.value] ?? 'info.main' }} aria-label={`priority ${p.value}`} />
    ),
  },
  {
    field: 'title',
    headerName: 'Signal',
    flex: 1,
    renderCell: (p) => (
      <Tooltip
        title={
          <Box sx={{ p: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.row.title}</Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>{p.row.source}{p.row.source_skill ? ` · ${p.row.source_skill}` : ''}</Typography>
            <Typography variant="caption" color="text.secondary">{friendly(p.row.created_at)} · priority {p.row.priority}</Typography>
          </Box>
        }
      >
        <span>{p.row.title}</span>
      </Tooltip>
    ),
  },
  {
    field: 'created_at',
    headerName: 'When',
    width: 80,
    renderCell: (p) => (
      <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }} color="text.secondary">{relativeTime(p.value)}</Typography>
    ),
  },
]

export default function SignalsWidget() {
  const { data = [], isLoading } = useQuery({ queryKey: ['signals', 'new'], queryFn: () => getSignals('new'), refetchInterval: 15000 })
  const navigate = useNavigate()
  const friendly = useFriendlyTime()
  const columns = useMemo(() => makeColumns(friendly), [friendly])
  const rows = data.filter((s) => s.type !== 'proactive')
  useWidgetCount(rows.length)

  if (!isLoading && rows.length === 0) {
    return <Typography variant="caption" color="text.secondary">No new signals.</Typography>
  }
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={isLoading}
      density="compact"
      hideFooter
      disableColumnMenu
      onRowClick={() => navigate('/inbox?status=new')}
      sx={{ border: 0, cursor: 'pointer', maxHeight: 320 }}
    />
  )
}
