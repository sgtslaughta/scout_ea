import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import { TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { getDeadlines, getTrends } from '@/api'
import { useFriendlyTime } from '@/lib/timePrefs'

const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return '0m'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function RightDrawer() {
  const navigate = useNavigate()
  const friendly = useFriendlyTime()
  const { data: deadlines = [], isLoading: deadlinesLoading, error: deadlinesError } = useQuery({
    queryKey: ['deadlines'],
    queryFn: () => getDeadlines(),
  })

  const { data: trends = [], isLoading: trendsLoading, error: trendsError } = useQuery({
    queryKey: ['trends'],
    queryFn: () => getTrends(),
  })
  const sortedDeadlines = [...deadlines].sort(
    (a, b) => a.countdown_seconds - b.countdown_seconds
  )
  const isUrgent = (seconds: number) => seconds < 86400 // < 24h
  const deadlinesError_ = (deadlinesError || trendsError) as Error | null

  return (
    <Box sx={{ width: 300, borderLeft: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
      {deadlinesError_ && <Alert severity="error" sx={{ m: 2 }}>Error loading drawer</Alert>}
      <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="overline" color="text.secondary">Deadlines</Typography>
          {deadlinesLoading ? (
            <Typography variant="caption" color="text.secondary">Loading…</Typography>
          ) : sortedDeadlines.length === 0 ? (
            <Typography variant="caption" color="text.secondary">No deadlines tracked.</Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {sortedDeadlines.map((item) => (
                <Tooltip
                  key={item.id}
                  placement="left"
                  title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.title}</Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>Due {friendly(item.due_at)}</Typography>
                      <Typography variant="caption" color="text.secondary">source: {item.source}</Typography>
                    </Box>
                  }
                >
                  <Paper
                    variant="outlined"
                    role="button"
                    tabIndex={0}
                    aria-label={item.title}
                    onClick={() => navigate('/deadlines')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/deadlines') } }}
                    sx={{
                      px: 1.5, py: 1, cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      ...(isUrgent(item.countdown_seconds) && { borderColor: 'error.main', bgcolor: 'rgba(var(--mui-palette-error-mainChannel) / 0.1)' }),
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.title}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                      <Clock size={12} />
                      <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        {formatCountdown(item.countdown_seconds)}
                      </Typography>
                    </Box>
                  </Paper>
                </Tooltip>
              ))}
            </Stack>
          )}
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="overline" color="text.secondary">Trending</Typography>
          {trendsLoading ? (
            <Typography variant="caption" color="text.secondary">Loading…</Typography>
          ) : trends.length === 0 ? (
            <Typography variant="caption" color="text.secondary">No trends data.</Typography>
          ) : (
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {trends.map((item) => (
                <Tooltip
                  key={item.id}
                  placement="left"
                  title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.term}</Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>{item.kind} · score {item.score}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.window_start} → {item.window_end}</Typography>
                    </Box>
                  }
                >
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-label={item.term}
                    onClick={() => navigate('/trending')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/trending') } }}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderRadius: 1, border: 1, borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>{item.term}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={item.delta && item.delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      label={item.delta ? (item.delta > 0 ? '+' : '') + item.delta + '%' : '—'}
                      color={item.delta && item.delta > 0 ? 'success' : 'default'}
                    />
                  </Box>
                </Tooltip>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  )
}
