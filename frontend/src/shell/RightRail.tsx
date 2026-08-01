import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { GripVertical } from 'lucide-react'
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

export interface RailTask {
  id: number
  title: string
  status: 'open' | 'in_progress' | 'done'
}

interface RightRailProps {
  tasks?: RailTask[]
  onReorder?: (ids: number[]) => void
  onStatusChange?: (id: number, status: RailTask['status']) => void
}

// Cycle order per spec: blank (open) -> green (done) -> orange (in_progress) -> open
const NEXT_STATUS: Record<RailTask['status'], RailTask['status']> = {
  open: 'done',
  done: 'in_progress',
  in_progress: 'open',
}

const STATUS_LABEL: Record<RailTask['status'], string> = {
  open: 'Mark as done',
  done: 'Done — mark as in progress',
  in_progress: 'In progress — mark as open',
}

const STATUS_COLOR: Record<RailTask['status'], string | undefined> = {
  open: undefined,
  done: 'success.main',
  in_progress: 'warning.main',
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
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={STATUS_LABEL[status]}
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: STATUS_COLOR[status] ?? 'transparent',
        cursor: 'pointer',
        p: 0,
      }}
    />
  )
}

function TaskRow({
  task,
  onStatusChange,
}: {
  task: RailTask
  onStatusChange: (id: number, status: RailTask['status']) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 2.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <StatusBox status={task.status} onClick={() => onStatusChange(task.id, NEXT_STATUS[task.status])} />
      <Typography variant="body1" sx={{ flex: 1 }}>
        {task.title}
      </Typography>
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
    </Box>
  )
}

// TODO(to-do sub-project): render the real list of tasks here.
export function RightRail({ tasks = [], onReorder = () => {}, onStatusChange = () => {} }: RightRailProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const ids = tasks.map(t => t.id)
  const handleDragEnd = createDragEndHandler(ids, onReorder)

  return (
    <RailCard heading="To do">
      {tasks.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          Nothing to do yet. Add your first task.
        </Typography>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </RailCard>
  )
}
