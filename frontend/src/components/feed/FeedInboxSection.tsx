import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Box, Chip, Typography, Tooltip } from '@mui/material'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'
import { CheckCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getSignals, setSignalStatus, type Signal } from '@/api'
import { relativeTime } from '@/widgets/SignalsWidget'
import { useFriendlyTime } from '@/lib/timePrefs'
import { ActionBadge } from '@/components/actions/ActionBadge'
import { ActionMenu } from '@/components/actions/ActionMenu'
import { ResponseDetailModal } from '@/components/quickdraw/ResponseDetailModal'

const PRIORITY_COLOR: Record<number, string> = { 1: 'error.main', 2: 'warning.main' }
const STATUSES = ['new', 'triaged', 'actioned', 'dismissed'] as const

export function FeedInboxSection() {
  const qc = useQueryClient()
  const friendly = useFriendlyTime()
  const [params] = useSearchParams()
  const [status, setStatus] = useState<string | undefined>(params.get('status') ?? undefined)
  const [proactive, setProactive] = useState(params.get('type') === 'proactive')
  const [detail, setDetail] = useState<Signal | null>(null)

  const { data: signals = [], isLoading } = useQuery({
    queryKey: ['signals'], queryFn: () => getSignals(), refetchInterval: 15000,
  })

  const rows = signals.filter(
    (s) => (!status || s.status === status) && (!proactive || s.type === 'proactive'),
  )

  const setStat = useMutation({
    mutationFn: ({ id, value }: { id: number; value: string }) => setSignalStatus('signals', id, value),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['signals'] }); toast.success(v.value === 'dismissed' ? 'Dismissed' : 'Updated') },
  })

  const columns: GridColDef[] = [
    {
      field: 'priority', headerName: '', width: 36, sortable: false, filterable: false,
      renderCell: (p) => <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_COLOR[p.row.priority] ?? 'info.main' }} aria-label={`priority ${p.row.priority}`} />,
    },
    {
      field: 'title', headerName: 'Signal', flex: 1,
      renderCell: (p) => (
        <Tooltip title={<Box sx={{ p: 0.5 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{p.row.title}</Typography><Typography variant="caption" color="text.secondary">{friendly(p.row.created_at)} · priority {p.row.priority}</Typography></Box>}>
          <Box role="button" tabIndex={0} onClick={() => setDetail(p.row as Signal)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(p.row as Signal) } }}
            sx={{ cursor: 'pointer', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.row.title}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'source', headerName: 'Source', width: 140,
      renderCell: (p) => <Chip size="small" variant="outlined" label={`${p.row.source}${p.row.source_skill ? ` · ${p.row.source_skill}` : ''}`} />,
    },
    {
      field: 'created_at', headerName: 'Created', width: 110,
      renderCell: (p) => <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{relativeTime(p.value)}</Typography>,
    },
    {
      field: 'actions', type: 'actions', width: 120,
      getActions: (p) => [
        <GridActionsCellItem key="badge" icon={<ActionBadge entityType="email" entityId={p.row.id} />} label="Action status" showInMenu={false} disabled />,
        <GridActionsCellItem key="menu" icon={<ActionMenu entity={{ type: 'email', id: p.row.id }} />} label="Actions" showInMenu={false} />,
        <GridActionsCellItem key="dismiss" icon={<Trash2 size={16} />} label="Dismiss" onClick={() => setStat.mutate({ id: p.row.id, value: 'dismissed' })} showInMenu={false} />,
        <GridActionsCellItem key="triage" icon={<CheckCircle size={16} />} label="Triage" onClick={() => setStat.mutate({ id: p.row.id, value: 'triaged' })} showInMenu={false} />,
      ],
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', gap: 0.5, p: 1, flexShrink: 0, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <Chip key={s} label={s} size="small" variant={status === s ? 'filled' : 'outlined'}
            onClick={() => setStatus(status === s ? undefined : s)} />
        ))}
        <Chip label="proactive" size="small" color="secondary" variant={proactive ? 'filled' : 'outlined'}
          onClick={() => setProactive((v) => !v)} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 0.5 }}>
        {!isLoading && rows.length === 0
          ? <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>Inbox is clear.</Typography>
          : <DataGrid rows={rows} columns={columns} loading={isLoading} disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              sx={{ border: 'none' }} />}
      </Box>
      <ResponseDetailModal open={!!detail} kind="signal" item={detail} onClose={() => setDetail(null)}
        onStatus={(value) => { if (detail) { setStat.mutate({ id: detail.id, value }); setDetail(null) } }} />
    </Box>
  )
}
