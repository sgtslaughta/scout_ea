import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import { BarChart } from '@mui/x-charts/BarChart'
import { Check, X } from 'lucide-react'
import { getActivity } from '@/api'
import { useWidgetCount } from './WidgetCard'

const ACCENT = 'var(--color-accent)'

export default function ActivityWidget() {
  const { data = [], isLoading } = useQuery({ queryKey: ['activity'], queryFn: () => getActivity(10), refetchInterval: 15000 })
  useWidgetCount(data.length)

  if (!isLoading && data.length === 0) {
    return <Typography variant="caption" color="text.secondary">No skill runs yet.</Typography>
  }

  // aggregate items created per skill (identity = skill, magnitude = items)
  const bySkill = new Map<string, number>()
  for (const a of data) bySkill.set(a.skill, (bySkill.get(a.skill) ?? 0) + a.items_created)
  const skills = [...bySkill.keys()]

  return (
    <Box>
      <BarChart
        height={150}
        series={[{ data: skills.map((s) => bySkill.get(s) ?? 0), color: ACCENT }]}
        xAxis={[{ scaleType: 'band', data: skills, tickLabelStyle: { fontSize: 10, angle: -25 } }]}
        barLabel="value"
        borderRadius={4}
        margin={{ top: 8, bottom: 24 }}
        slotProps={{ legend: { hidden: true } }}
      />
      <Stack spacing={0.25} sx={{ mt: 1 }}>
        {data.slice(0, 5).map((a) => (
          <Tooltip key={a.id} title={`${a.skill} — ${a.items_created} items · ${a.status}${a.note ? ` · ${a.note}` : ''}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.25 }}>
              {a.status === 'error'
                ? <X size={13} aria-label="error" style={{ color: 'var(--mui-palette-error-main)' }} />
                : <Check size={13} aria-label="ok" style={{ color: 'var(--mui-palette-success-main)' }} />}
              <Typography variant="caption" fontFamily='"JetBrains Mono", monospace' sx={{ flex: 1 }} noWrap>{a.skill}</Typography>
              <Typography variant="caption" color="text.secondary">{a.items_created} items</Typography>
            </Box>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  )
}
