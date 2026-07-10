import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { BarChart } from '@mui/x-charts/BarChart'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { getTrends } from '@/api'
import { useWidgetCount } from './WidgetCard'

const ACCENT = 'var(--color-accent)'

export default function TrendingWidget() {
  const { data = [], isLoading } = useQuery({ queryKey: ['trends'], queryFn: () => getTrends(), refetchInterval: 15000 })
  const top = [...data].sort((a, b) => b.score - a.score).slice(0, 5)
  useWidgetCount(data.length)

  if (!isLoading && top.length === 0) {
    return <Typography variant="caption" color="text.secondary">No trends yet.</Typography>
  }
  return (
    <Box>
      <BarChart
        height={140}
        series={[{ data: top.map((t) => t.score), color: ACCENT, valueFormatter: (v) => `${v}`, barLabel: 'value' }]}
        xAxis={[{ scaleType: 'band', data: top.map((t) => t.term), tickLabelStyle: { fontSize: 10 } }]}
        borderRadius={4}
        margin={{ top: 8, bottom: 4 }}
      />
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {top.map((t) => (
          <Box
            key={t.id}
            component={Link}
            to="/trending?dir=rising"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1, textDecoration: 'none', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>{t.term}</Typography>
            <Chip
              size="small"
              variant="outlined"
              icon={(t.delta ?? 0) > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              label={t.delta != null ? `${t.delta > 0 ? '+' : ''}${t.delta}%` : '—'}
              color={(t.delta ?? 0) > 0 ? 'success' : 'default'}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
