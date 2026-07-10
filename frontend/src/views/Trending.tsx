import { useQuery } from '@tanstack/react-query'
import { getTrends, type Trend } from '@/api'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Box, Typography, Chip, Button, useTheme } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'

export function TrendingView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const theme = useTheme()
  const { data: trends = [], isLoading, error, refetch: refetchTrends } = useQuery<Trend[]>({
    queryKey: ['trends'],
    queryFn: () => getTrends(),
  })

  const risingOnly = searchParams.get('dir') === 'rising'
  const visibleTrends = risingOnly ? trends.filter((t) => (t.delta ?? 0) > 0) : trends

  const columns: GridColDef<Trend>[] = [
    {
      field: 'term',
      headerName: 'Term',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">{params.row.term}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: '"JetBrains Mono", monospace' }}>
            {params.row.kind} {params.row.count ? `• ${params.row.count} signals` : ''}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'score',
      headerName: 'Score',
      width: 80,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <span style={{ fontFamily: '"JetBrains Mono"' }}>
          {(params.value as number).toFixed(1)}
        </span>
      ),
    },
    {
      field: 'delta',
      headerName: 'Delta',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const delta = params.row.delta as number | undefined
        if (delta === undefined) return null
        const isPositive = delta > 0
        return (
          <Chip
            icon={isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            label={`${isPositive ? '+' : ''}${delta.toFixed(1)}%`}
            size="small"
            color={isPositive ? 'success' : 'default'}
          />
        )
      },
    },
    {
      field: 'count',
      headerName: 'Count',
      width: 70,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => params.value,
    },
  ]

  if (error) {
    return (
      <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 6, bgcolor: 'bg.main' }}>
        <Box sx={{ maxWidth: '1080px', mx: 'auto' }}>
          <Box
            sx={{
              bgcolor: theme.palette.error.main,
              opacity: 0.3,
              border: `1px solid ${theme.palette.error.main}`,
              borderRadius: 1,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              Error loading trends
            </Typography>
            <Button
              size="small"
              onClick={() => refetchTrends()}
              sx={{ color: 'error.main', textDecoration: 'underline' }}
            >
              Retry
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 6, bgcolor: 'bg.main' }}>
      <Box sx={{ maxWidth: '1080px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 'semibold' }}>
            Trending
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
            Top trends from your signals
          </Typography>
        </Box>

        {risingOnly && (
          <Box>
            <Chip
              label="Rising"
              onDelete={() => setSearchParams({})}
              size="small"
            />
          </Box>
        )}

        {!isLoading && visibleTrends.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No trending data yet.</Typography>
        ) : (
          <DataGrid
            rows={visibleTrends}
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
