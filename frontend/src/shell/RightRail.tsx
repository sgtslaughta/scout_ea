import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import FormControl from '@mui/material/FormControl'
import {
  GripVertical,
  Circle,
  CheckCircle2,
  CircleDashed,
  Eye,
  EyeOff,
  ChevronUp,
  Minus,
  ChevronDown,
  Flame,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RailCard } from './RailCard'
import { getTasks, createTask, updateTask } from '@/api'

export interface RailTask {
  id: number
  title: string
  status: 'open' | 'in_progress' | 'done'
  priority: number
}

// Follows how work actually moves: not started -> in progress -> done, then
// back round to not started for a task you need to reopen.
const NEXT_STATUS: Record<RailTask['status'], RailTask['status']> = {
  open: 'in_progress',
  in_progress: 'done',
  done: 'open',
}

/** What the current state means, in the user's words. Shown on hover. */
const STATUS_MEANING: Record<RailTask['status'], string> = {
  open: 'Not started',
  done: 'Done',
  in_progress: 'In progress',
}

/** What clicking does next, for the accessible name. */
const STATUS_ACTION: Record<RailTask['status'], string> = {
  open: 'Mark as in progress',
  in_progress: 'Mark as done',
  done: 'Mark as not started',
}

const STATUS_ICON: Record<RailTask['status'], LucideIcon> = {
  open: Circle,
  done: CheckCircle2,
  in_progress: CircleDashed,
}

// Colour alone can't say what a state means — every status carries its own
// glyph and a hover tooltip too.
const STATUS_COLOR: Record<RailTask['status'], string> = {
  open: 'text.disabled',
  done: 'success.main',
  in_progress: 'warning.main',
}

// The app-wide 1-5 priority scale collapsed to three buckets a rail this
// narrow can show at a glance: 1-2 high, 3 normal, 4-5 low.
export type Bucket = 'high' | 'normal' | 'low'

export function toBucket(priority: number): Bucket {
  if (priority <= 2) return 'high'
  if (priority >= 4) return 'low'
  return 'normal'
}

// Writing back only ever uses these mid-bucket values, so a skill-written 1
// or 5 is left alone unless the user actually moves that task's bucket.
export const BUCKET_WRITE: Record<Bucket, number> = { high: 2, normal: 3, low: 4 }

const NEXT_BUCKET: Record<Bucket, Bucket> = { high: 'normal', normal: 'low', low: 'high' }

const BUCKET_MEANING: Record<Bucket, string> = {
  high: 'High priority',
  normal: 'Normal priority',
  low: 'Low priority',
}

const BUCKET_ACTION: Record<Bucket, string> = {
  high: 'Set to normal priority',
  normal: 'Set to low priority',
  low: 'Set to high priority',
}

const BUCKET_ICON: Record<Bucket, LucideIcon> = {
  high: ChevronUp,
  normal: Minus,
  low: ChevronDown,
}

// Colour alone can't say what a bucket means — every bucket carries its own
// glyph and a hover tooltip too.
const BUCKET_COLOR: Record<Bucket, string> = {
  high: 'error.main',
  normal: 'text.secondary',
  low: 'text.disabled',
}

// Pure mapping from a drag-end (active/over ids) onto the new task order.
export function reorderIds(ids: number[], activeId: number, overId: number | undefined): number[] {
  if (overId == null || activeId === overId) return ids
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from === -1 || to === -1) return ids
  const next = ids.slice()
  next.splice(from, 1)
  next.splice(to, 0, activeId)
  return next
}

// Builds the exact handler passed to DndContext's onDragEnd, so tests can
// invoke it directly instead of simulating pointer drags in jsdom.
export function createDragEndHandler(ids: number[], onReorder: (ids: number[]) => void) {
  return (event: DragEndEvent) => {
    const activeId = Number(event.active.id)
    const overId = event.over ? Number(event.over.id) : undefined
    onReorder(reorderIds(ids, activeId, overId))
  }
}

function StatusBox({ status, onClick }: { status: RailTask['status']; onClick: () => void }) {
  const Icon = STATUS_ICON[status]
  return (
    <Tooltip title={`${STATUS_MEANING[status]} — click to ${STATUS_ACTION[status].toLowerCase()}`}>
      <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-label={`${STATUS_MEANING[status]}. ${STATUS_ACTION[status]}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 1,
          border: 'none',
          bgcolor: 'transparent',
          color: STATUS_COLOR[status],
          cursor: 'pointer',
          p: 0,
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        <Icon size={22} aria-hidden />
      </Box>
    </Tooltip>
  )
}

function BucketBox({ priority, onClick }: { priority: number; onClick: () => void }) {
  const bucket = toBucket(priority)
  const Icon = BUCKET_ICON[bucket]
  return (
    <Tooltip title={`${BUCKET_MEANING[bucket]} — click to ${BUCKET_ACTION[bucket].toLowerCase()}`}>
      <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-label={`${BUCKET_MEANING[bucket]}. ${BUCKET_ACTION[bucket]}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 32,
          flexShrink: 0,
          borderRadius: 1,
          border: 'none',
          bgcolor: 'transparent',
          color: BUCKET_COLOR[bucket],
          cursor: 'pointer',
          p: 0,
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        <Icon size={18} aria-hidden />
      </Box>
    </Tooltip>
  )
}

function TaskRow({
  task,
  draggable,
  onStatusChange,
  onPriorityChange,
}: {
  task: RailTask
  draggable: boolean
  onStatusChange: (id: number, status: RailTask['status']) => void
  onPriorityChange: (id: number, bucket: Bucket) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    disabled: !draggable,
  })

  return (
    <Box
      ref={setNodeRef}
      style={draggable ? { transform: CSS.Transform.toString(transform), transition } : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 2.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <StatusBox status={task.status} onClick={() => onStatusChange(task.id, NEXT_STATUS[task.status])} />
      <BucketBox
        priority={task.priority}
        onClick={() => onPriorityChange(task.id, NEXT_BUCKET[toBucket(task.priority)])}
      />
      <Typography variant="body1" sx={{ flex: 1 }}>
        {task.title}
      </Typography>
      {draggable && (
        <Box
          component="button"
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${task.title}`}
          aria-roledescription="sortable"
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            border: 'none',
            bgcolor: 'transparent',
            color: 'text.secondary',
            cursor: 'grab',
            p: 0.5,
          }}
        >
          <GripVertical size={20} />
        </Box>
      )}
    </Box>
  )
}

/** Sort weight for "by status": in progress first, then not started, done last. */
const STATUS_RANK: Record<RailTask['status'], number> = {
  in_progress: 0,
  open: 1,
  done: 2,
}

export type SortMode = 'manual' | 'priority' | 'status'

/**
 * Applies the rail's view options. Manual drag order is the default; sorting by
 * priority or status is a view over the same list and deliberately doesn't rewrite
 * `sort`, so switching back to Manual restores the user's own ordering.
 */
export function applyView(
  tasks: RailTask[],
  opts: { hideDone: boolean; sort: SortMode; onlyHigh: boolean },
): RailTask[] {
  let visible = opts.hideDone ? tasks.filter((t) => t.status !== 'done') : tasks
  if (opts.onlyHigh) visible = visible.filter((t) => toBucket(t.priority) === 'high')
  if (opts.sort === 'priority') return [...visible].sort((a, b) => a.priority - b.priority)
  if (opts.sort === 'status') return [...visible].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
  return visible
}

export function RightRail() {
  const qc = useQueryClient()
  const [newTitle, setNewTitle] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [onlyHigh, setOnlyHigh] = useState(false)
  const [sort, setSort] = useState<SortMode>('manual')
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const { data: rawTasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 15000 })
  // The rail only cycles open/in_progress/done; dismissed tasks don't appear here.
  const tasks: RailTask[] = rawTasks
    .filter((t) => t.status !== 'dismissed')
    .map((t) => ({ id: t.id, title: t.title, status: t.status as RailTask['status'], priority: t.priority }))

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: RailTask['status'] }) => updateTask(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const priorityMutation = useMutation({
    mutationFn: ({ id, bucket }: { id: number; bucket: Bucket }) => updateTask(id, { priority: BUCKET_WRITE[bucket] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      await Promise.all(
        orderedIds
          .map((id, index) => ({ id, index }))
          .filter(({ id, index }) => rawTasks.find((t) => t.id === id)?.sort !== index)
          .map(({ id, index }) => updateTask(id, { sort: index })),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const createMutation = useMutation({
    mutationFn: (title: string) => createTask({ title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setNewTitle('')
    },
  })

  const shown = applyView(tasks, { hideDone, sort, onlyHigh })
  const doneCount = tasks.filter((t) => t.status === 'done').length

  // Dragging reorders the real list, so it only makes sense in manual mode —
  // a drag inside a computed sort looks like it works, then snaps back on the
  // next refetch. Rows render without drag handles or Dnd wiring otherwise.
  const manual = sort === 'manual'
  const ids = shown.map((t) => t.id)
  const handleDragEnd = createDragEndHandler(ids, (nextIds) => reorderMutation.mutate(nextIds))

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTitle.trim()) {
      createMutation.mutate(newTitle.trim())
    }
  }

  const rows = shown.map((task) => (
    <TaskRow
      key={task.id}
      task={task}
      draggable={manual}
      onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
      onPriorityChange={(id, bucket) => priorityMutation.mutate({ id, bucket })}
    />
  ))

  return (
    <RailCard heading="To do">
      <TextField
        placeholder="Add a task…"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={handleAddKeyDown}
        variant="standard"
        fullWidth
        slotProps={{ htmlInput: { 'aria-label': 'Add a task' } }}
        sx={{ mb: 1.5 }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <FormControl variant="standard" size="small" sx={{ minWidth: 110 }}>
          <InputLabel id="rail-sort-label">Sort by</InputLabel>
          <Select
            labelId="rail-sort-label"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <MenuItem value="manual">Manual</MenuItem>
            <MenuItem value="priority">Priority</MenuItem>
            <MenuItem value="status">Status</MenuItem>
          </Select>
        </FormControl>
        {/* describeChild: without it MUI copies the tooltip title onto the chip
            as aria-label, so the accessible name became "Show only high
            priority tasks" while the chip visibly reads "High only" — voice
            control can't act on a label it can't see (WCAG 2.5.3). */}
        <Tooltip describeChild title={onlyHigh ? 'Show every task' : 'Show only high priority tasks'}>
          <Chip
            size="medium"
            icon={<Flame size={16} />}
            label="High only"
            onClick={() => setOnlyHigh((v) => !v)}
            color={onlyHigh ? 'primary' : 'default'}
            variant={onlyHigh ? 'filled' : 'outlined'}
            aria-pressed={onlyHigh}
          />
        </Tooltip>
        <Tooltip describeChild title={hideDone ? 'Show finished tasks again' : 'Hide anything already done'}>
          <Chip
            size="medium"
            icon={hideDone ? <EyeOff size={16} /> : <Eye size={16} />}
            label={doneCount > 0 ? `Hide done (${doneCount})` : 'Hide done'}
            onClick={() => setHideDone((v) => !v)}
            color={hideDone ? 'primary' : 'default'}
            variant={hideDone ? 'filled' : 'outlined'}
            aria-pressed={hideDone}
          />
        </Tooltip>
      </Box>

      {shown.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          {tasks.length === 0
            ? 'Nothing to do yet. Add your first task.'
            : 'Everything here is done. Nice.'}
        </Typography>
      ) : manual ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {rows}
          </SortableContext>
        </DndContext>
      ) : (
        rows
      )}
    </RailCard>
  )
}
