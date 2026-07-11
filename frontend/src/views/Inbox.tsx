import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Chip,
  Tooltip,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
} from '@mui/x-data-grid'
import { CheckCircle, Trash2 } from 'lucide-react'
import { getSignals, setSignalStatus } from '@/api'
import { toast } from 'sonner'
import { relativeTime } from '@/widgets/SignalsWidget'
import { useFriendlyTime } from '@/lib/timePrefs'
import { ActionBadge } from '@/components/actions/ActionBadge'
import { ActionMenu } from '@/components/actions/ActionMenu'

const PRIORITY_COLOR: Record<number, string> = { 1: 'error.main', 2: 'warning.main' }

const statusFilters = ['new', 'triaged', 'actioned', 'dismissed']

export function InboxView() {
  const queryClient = useQueryClient()
  const friendly = useFriendlyTime()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeStatus, setActiveStatus] = useState('new')

  // Initialize activeStatus from query param if present
  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam) setActiveStatus(statusParam)
  }, [searchParams])

  const { data: signals = [], isLoading, error, refetch } = useQuery({
    queryKey: ['signals', activeStatus],
    queryFn: () => getSignals(activeStatus),
    refetchInterval: 15000,
  })

  const proactiveOnly = searchParams.get('type') === 'proactive'
  const visibleSignals = proactiveOnly
    ? signals.filter((s) => s.type === 'proactive')
    : signals

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('signals', id, 'dismissed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      toast.success('Dismissed')
    },
    onError: () => toast.error('Failed to dismiss'),
  })

  const triageMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('signals', id, 'triaged'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      toast.success('Triaged')
    },
    onError: () => toast.error('Failed to triage'),
  })

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
      headerName: 'Signal',
      flex: 1,
      renderCell: (params) => (
        <Tooltip
          title={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{params.row.title}</Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>{params.row.source}{params.row.source_skill ? ` · ${params.row.source_skill}` : ''}</Typography>
              <Typography variant="caption" color="text.secondary">{friendly(params.row.created_at)} · priority {params.row.priority}</Typography>
            </Box>
          }
        >
          <span>{params.row.title}</span>
        </Tooltip>
      ),
    },
    {
      field: 'source',
      headerName: 'Source',
      width: 140,
      renderCell: (params) => (
        <Chip
          size="small"
          variant="outlined"
          label={`${params.row.source}${params.row.source_skill ? ` · ${params.row.source_skill}` : ''}`}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 110,
      renderCell: (params) => (
        <Typography
          variant="caption"
          sx={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {relativeTime(params.value)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      width: 140,
      getActions: (params) => [
        <GridActionsCellItem
          key="badge"
          icon={<ActionBadge entityType="email" entityId={params.row.id} />}
          label="Action status"
          showInMenu={false}
          disabled
        />,
        <GridActionsCellItem
          key="menu"
          icon={<ActionMenu entity={{ type: 'email', id: params.row.id }} />}
          label="Actions"
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
        <GridActionsCellItem
          key="triage"
          icon={<CheckCircle size={16} />}
          label="Triage"
          onClick={() => triageMutation.mutate(params.row.id)}
          disabled={triageMutation.isPending}
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
          Inbox
        </Typography>

        {/* Drill-down type filter chip */}
        {proactiveOnly && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Chip
              label="Proactive"
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
                label={status.charAt(0).toUpperCase() + status.slice(1)}
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
            <Typography variant="body2">Error loading signals</Typography>
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
        {!isLoading && visibleSignals.length === 0 && (
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              p: 4,
              color: 'text.secondary',
            }}
          >
            Inbox is clear. Check back later for new signals.
          </Typography>
        )}

        {/* DataGrid */}
        {visibleSignals.length > 0 && (
          <DataGrid
            rows={visibleSignals}
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
      </Box>
    </Box>
  )
}
