import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Stack } from '@mui/material'
import { ArrowRight } from 'lucide-react'
import { getDeadlines, getTasks, getEvents } from '@/api'
import { TimelineTypeChip } from '@/components/TimelineTypeChip'
import { buildApproaching, formatCountdown, URGENCY_CHIP, type ApproachItem } from './quickdrawData'
import { QuickdrawSection } from './QuickdrawSection'
import { QuickdrawItem, type QuickdrawAction } from './QuickdrawItem'

const ROUTE: Record<ApproachItem['type'], string> = { deadline: '/deadlines', task: '/tasks', event: '/calendar' }
const CHIP_COLOR: Record<'error' | 'warning' | 'info' | 'default', string> = {
  error: 'error.main', warning: 'warning.main', info: 'info.main', default: 'text.secondary',
}

export function ApproachingSection({ expanded, collapsed, onToggle }: { expanded: boolean; collapsed: boolean; onToggle: (id: string) => void }) {
  const navigate = useNavigate()
  const deadlinesQ = useQuery({ queryKey: ['deadlines'], queryFn: () => getDeadlines(), refetchInterval: 15000 })
  const tasksQ = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 15000 })
  const eventsQ = useQuery({ queryKey: ['events'], queryFn: getEvents, refetchInterval: 15000 })

  const rows = buildApproaching(deadlinesQ.data ?? [], tasksQ.data ?? [], eventsQ.data ?? [], new Date())
  const open = (r: ApproachItem) => navigate(`${ROUTE[r.type]}?focus=${r.id}`)
  const actionsFor = (r: ApproachItem): QuickdrawAction[] => [
    { label: 'Take action', icon: <ArrowRight size={14} />, onClick: () => open(r) },
  ]

  return (
    <QuickdrawSection
      id="approaching" label="Approaching" count={rows.length} collapsed={collapsed} onToggle={onToggle}
      loading={deadlinesQ.isLoading || tasksQ.isLoading || eventsQ.isLoading}
      error={!!deadlinesQ.error || !!tasksQ.error || !!eventsQ.error}
      empty="All quiet on the range."
    >
      <Stack spacing={0.25} sx={{ px: 0.5 }}>
        {rows.map((r) => (
          <QuickdrawItem
            key={r.key}
            glyph={<TimelineTypeChip type={r.type} dense />}
            title={r.title} meta={formatCountdown(r.seconds)} metaColor={CHIP_COLOR[URGENCY_CHIP[r.urgency]]}
            expanded={expanded} actions={actionsFor(r)} onOpen={() => open(r)}
          />
        ))}
      </Stack>
    </QuickdrawSection>
  )
}
