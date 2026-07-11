import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Box, Typography, Tooltip, IconButton, Chip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { CheckCircle, Trash2, Flag } from 'lucide-react'
import { useFriendlyTime } from '@/lib/timePrefs'
import { urgencyOf, type Urgency } from '@/lib/horizon'
import { formatCountdown } from '@/widgets/DeadlinesWidget'
import type { Task } from '@/api'

const PRIORITY_COLOR: Record<number, string> = { 1: 'error.main', 2: 'warning.main' }
const PRIORITY_CHIP: Record<number, { label: string; color: 'error' | 'warning' | 'info' }> = {
  1: { label: 'Critical', color: 'error' }, 2: { label: 'High', color: 'warning' }, 3: { label: 'Normal', color: 'info' },
}
const URGENCY_CHIP: Record<Urgency, 'error' | 'warning' | 'info'> = {
  critical: 'error', urgent: 'error', soon: 'warning', normal: 'info',
}
// countdown chip animation by proximity (reduced-motion gated)
const countdownAnim = (u: Urgency): SxProps<Theme> =>
  u === 'critical'
    ? { '@keyframes cdFlash': { '0%': { opacity: 1 }, '100%': { opacity: 0.35 } }, '@media (prefers-reduced-motion: no-preference)': { animation: 'cdFlash 0.8s steps(2) infinite' } }
    : u === 'urgent'
      ? { '@keyframes cdPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } }, '@media (prefers-reduced-motion: no-preference)': { animation: 'cdPulse 2s ease-in-out infinite' } }
      : {}

function dueLabel(due?: string): { text: string; color: string } | null {
  if (!due) return null
  const d = new Date(due)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const text = same(d, today) ? 'Today' : same(d, tomorrow) ? 'Tomorrow'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const color = same(d, today) ? 'warning.main' : d < today ? 'error.main' : 'text.secondary'
  return { text, color }
}

interface TaskCardProps {
  task: Task
  onEdit: (t: Task) => void
  onComplete: (id: number) => void
  onDismiss: (id: number) => void
  onConvert: (t: Task) => void
}

export function TaskCard({ task, onEdit, onComplete, onDismiss, onConvert }: TaskCardProps) {
  const friendly = useFriendlyTime()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id, data: { columnId: task.board_column_id ?? null },
  })
  const due = dueLabel(task.due_at)
  const isDone = task.status === 'done'

  const dueSecs = task.due_at ? Math.floor((new Date(task.due_at).getTime() - Date.now()) / 1000) : null
  const urgency: Urgency = dueSecs != null ? urgencyOf(dueSecs) : 'normal'
  const countdownText = dueSecs == null ? null : dueSecs <= 0 ? 'overdue' : `due in ${formatCountdown(dueSecs)}`

  const hoverCard = (
    <Box sx={{ p: 0.5, maxWidth: 280 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{task.title}</Typography>
      {task.detail && <Typography variant="caption" sx={{ display: 'block', mt: 0.5, whiteSpace: 'pre-wrap' }}>{task.detail}</Typography>}
      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip size="small" variant="outlined" color={PRIORITY_CHIP[task.priority]?.color ?? 'info'} label={PRIORITY_CHIP[task.priority]?.label ?? `P${task.priority}`} />
        {countdownText && <Chip size="small" color={URGENCY_CHIP[urgency]} label={countdownText} sx={countdownAnim(urgency)} />}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Status: {task.status.replace('_', ' ')}</Typography>
      {task.due_at && <Typography variant="caption" sx={{ display: 'block' }}>Due {friendly(task.due_at)}</Typography>}
      {task.created_at && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Created {friendly(task.created_at)}</Typography>}
    </Box>
  )

  return (
    <Tooltip arrow placement="right" enterDelay={400} title={hoverCard}>
      <Box
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform) }}
        {...attributes}
        {...listeners}
        onClick={() => onEdit(task)}
        role="button"
        aria-label={`Edit ${task.title}`}
        sx={{
          p: 1, mb: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper', cursor: 'grab', opacity: isDragging ? 0.4 : 1,
          '&:hover': { borderColor: 'primary.main' },
          '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: 2 },
          touchAction: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
          <Box sx={{ mt: 0.5, width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: PRIORITY_COLOR[task.priority] ?? 'info.main' }} aria-label={`priority ${task.priority}`} />
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, lineHeight: 1.3, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'text.secondary' : 'text.primary' }}>{task.title}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, pl: 1.75 }}>
          {due && (
            <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace', color: due.color }}>{due.text}</Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" aria-label="Complete" onClick={(e) => { e.stopPropagation(); onComplete(task.id) }} sx={{ p: 0.25, color: isDone ? 'success.main' : 'inherit' }}>
            <CheckCircle size={14} />
          </IconButton>
          <IconButton size="small" aria-label="Convert to deadline" onClick={(e) => { e.stopPropagation(); onConvert(task) }} sx={{ p: 0.25 }}>
            <Flag size={14} />
          </IconButton>
          <IconButton size="small" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); onDismiss(task.id) }} sx={{ p: 0.25 }}>
            <Trash2 size={14} />
          </IconButton>
        </Box>
      </Box>
    </Tooltip>
  )
}
