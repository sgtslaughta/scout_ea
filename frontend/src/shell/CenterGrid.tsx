import { Suspense, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultAnnouncements,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WIDGETS, type WidgetSize, type WidgetDef } from '@/widgets/registry'
import { WidgetCard } from '@/widgets/WidgetCard'
import {
  defaultLayout, loadLayout, saveLayout, reorderWidgets, setWidgetHidden,
} from '@/widgets/layout'
import type { DashboardLayout } from '@/widgets/layout'

const ALL_KEYS = WIDGETS.map((w) => w.key)

export const SPAN: Record<WidgetSize, string> = { sm: 'span 1', lg: 'span 2' }
const SKELETON_HEIGHT: Record<WidgetSize, number> = { sm: 180, lg: 260 }

// Builds the exact handler passed to DndContext's onDragEnd, so tests can
// invoke it directly instead of simulating pointer drags in jsdom.
export function createDragEndHandler(layout: DashboardLayout, setLayout: (l: DashboardLayout) => void) {
  return (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return
    setLayout(reorderWidgets(layout, String(event.active.id), String(event.over.id)))
  }
}

interface SortableTileProps {
  tileKey: string
  size: WidgetSize
  title: string
  drillDown?: string | (() => void)
  onRefresh: () => void
  onHide: () => void
  emptyState?: WidgetDef['emptyState']
  settings?: WidgetDef['settings']
  children: React.ReactNode
}

function SortableTile({ tileKey, size, title, drillDown, onRefresh, onHide, emptyState, settings, children }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: tileKey })

  return (
    <Box
      ref={setNodeRef}
      data-widget-tile
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{ gridColumn: SPAN[size] }}
    >
      <WidgetCard
        title={title}
        drillDown={drillDown}
        onRefresh={onRefresh}
        onHide={onHide}
        emptyState={emptyState}
        settings={settings}
        dragHandle={{ attributes, listeners, setActivatorNodeRef }}
      >
        {children}
      </WidgetCard>
    </Box>
  )
}

export function CenterGrid() {
  const [layout, setLayoutState] = useState(() => loadLayout(ALL_KEYS))
  const [manageAnchor, setManageAnchor] = useState<HTMLElement | null>(null)
  const queryClient = useQueryClient()

  const setLayout = (next: DashboardLayout) => {
    setLayoutState(next)
    saveLayout(next)
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const hidden = useMemo(() => new Set(layout.hidden), [layout])
  const visible = layout.order.filter((k) => !hidden.has(k))
  const handleDragEnd = createDragEndHandler(layout, setLayout)

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mb: 2.5 }}>
        <Button startIcon={<SlidersHorizontal size={16} />} onClick={(e) => setManageAnchor(e.currentTarget)}>
          Manage tiles
        </Button>
        <Button startIcon={<RotateCcw size={16} />} onClick={() => setLayout(defaultLayout(ALL_KEYS))}>
          Reset
        </Button>
        <Menu anchorEl={manageAnchor} open={!!manageAnchor} onClose={() => setManageAnchor(null)}>
          {WIDGETS.map((w) => {
            const isHidden = hidden.has(w.key)
            return (
              <MenuItem
                key={w.key}
                role="menuitemcheckbox"
                aria-checked={!isHidden}
                onClick={() => setLayout(setWidgetHidden(layout, w.key, !isHidden))}
              >
                <Checkbox edge="start" checked={!isHidden} tabIndex={-1} disableRipple />
                <ListItemText primary={w.title} />
              </MenuItem>
            )
          })}
        </Menu>
      </Box>
      <DndContext sensors={sensors} accessibility={{ announcements: defaultAnnouncements }} onDragEnd={handleDragEnd}>
        <SortableContext items={visible} strategy={rectSortingStrategy}>
          {/* minmax(0, 1fr), not 1fr: a track's default `auto` minimum lets wide
              content (long timestamps, unbroken URLs) push the column past the
              container instead of wrapping. */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2.5 }}>
            {visible.map((key) => {
              const def = WIDGETS.find((w) => w.key === key)
              if (!def) return null
              const W = def.component
              return (
                <SortableTile
                  key={key}
                  tileKey={key}
                  size={def.size}
                  title={def.title}
                  drillDown={def.drillDown}
                  onRefresh={() => def.queryKeys.forEach((qk) => queryClient.invalidateQueries({ queryKey: qk }))}
                  onHide={() => setLayout(setWidgetHidden(layout, key, true))}
                  emptyState={def.emptyState}
                  settings={def.settings}
                >
                  <Suspense fallback={<Skeleton variant="rounded" height={SKELETON_HEIGHT[def.size]} />}>
                    <W />
                  </Suspense>
                </SortableTile>
              )
            })}
            {visible.length === 0 && (
              <Box sx={{ gridColumn: 'span 2', textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">All tiles are hidden — use "Manage tiles" to bring one back.</Typography>
              </Box>
            )}
          </Box>
        </SortableContext>
      </DndContext>
    </Box>
  )
}
