import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import { Calendar, CheckSquare } from 'lucide-react'
import { getEvents, getTasks } from '@/api'
import { useWidgetCount } from './WidgetCard'

function isToday(iso?: string): boolean {
  if (!iso) return false
  return new Date(iso).toDateString() === new Date().toDateString()
}

export default function TodayWidget() {
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: getEvents, refetchInterval: 15000 })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 15000 })

  const todaysEvents = events.filter((e) => isToday(e.chosen_time))
  const dueTasks = tasks.filter((t) => t.status !== 'done' && isToday(t.due_at))
  useWidgetCount(todaysEvents.length + dueTasks.length)

  if (todaysEvents.length === 0 && dueTasks.length === 0) {
    return <Typography variant="caption" color="text.secondary">Nothing scheduled today.</Typography>
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      <Stack spacing={0.5}>
        <Typography variant="overline" color="text.secondary">Events</Typography>
        {todaysEvents.length === 0 && <Typography variant="caption" color="text.secondary">None today.</Typography>}
        {todaysEvents.map((e) => (
          <Box key={e.id} component={Link} to="/calendar" sx={{ display: 'flex', gap: 1, alignItems: 'center', textDecoration: 'none', color: 'text.primary', px: 1, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
            <Calendar size={13} />
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>{e.title}</Typography>
            {e.chosen_time && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{new Date(e.chosen_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>}
          </Box>
        ))}
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="overline" color="text.secondary">Tasks due</Typography>
        {dueTasks.length === 0 && <Typography variant="caption" color="text.secondary">None due.</Typography>}
        {dueTasks.map((t) => (
          <Box key={t.id} component={Link} to="/tasks?due=today" sx={{ display: 'flex', gap: 1, alignItems: 'center', textDecoration: 'none', color: 'text.primary', px: 1, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
            <CheckSquare size={13} />
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>{t.title}</Typography>
            {t.priority <= 1 && <Chip size="small" label="P1" color="error" variant="outlined" sx={{ height: 16, fontSize: 10 }} />}
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
