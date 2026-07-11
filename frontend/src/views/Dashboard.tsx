import { Suspense, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import { WIDGETS, type WidgetSize } from '@/widgets/registry'
import { WidgetCard } from '@/widgets/WidgetCard'
import {
  defaultLayout, loadLayout, saveLayout, moveWidget, setWidgetHidden,
} from '@/widgets/layout'

const SPAN: Record<WidgetSize, { xs: string; md: string }> = {
  sm: { xs: 'span 12', md: 'span 4' },
  md: { xs: 'span 12', md: 'span 6' },
  lg: { xs: 'span 12', md: 'span 12' },
}

const ALL_KEYS = WIDGETS.map((w) => w.key)

export function DashboardView() {
  const [layout, setLayoutState] = useState(() => loadLayout(ALL_KEYS))
  const [manageAnchor, setManageAnchor] = useState<HTMLElement | null>(null)
  const queryClient = useQueryClient()

  const setLayout = (next: typeof layout) => {
    setLayoutState(next)
    saveLayout(next)
  }

  const hidden = useMemo(() => new Set(layout.hidden), [layout])
  const visible = layout.order.filter((k) => !hidden.has(k))

  return (
    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Button size="small" startIcon={<SlidersHorizontal size={14} />} onClick={(e) => setManageAnchor(e.currentTarget)} aria-label="Manage widgets">
          Manage widgets
        </Button>
        <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => setLayout(defaultLayout(ALL_KEYS))} aria-label="Reset layout">
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
                <Checkbox edge="start" checked={!isHidden} tabIndex={-1} disableRipple size="small" />
                <ListItemText primary={w.title} />
              </MenuItem>
            )
          })}
        </Menu>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
        {visible.map((key) => {
          const def = WIDGETS.find((w) => w.key === key)
          if (!def) return null
          const W = def.component
          return (
            <Box key={key} sx={{ gridColumn: SPAN[def.size] }}>
              <WidgetCard
                title={def.title}
                drillDown={def.drillDown}
                onRefresh={() => def.queryKeys.forEach((qk) => queryClient.invalidateQueries({ queryKey: qk }))}
                onMove={(dir) => setLayout(moveWidget(layout, key, dir))}
                onHide={() => setLayout(setWidgetHidden(layout, key, true))}
              >
                <Suspense fallback={<Skeleton variant="rounded" height={120} />}>
                  <W />
                </Suspense>
              </WidgetCard>
            </Box>
          )
        })}
        {visible.length === 0 && (
          <Box sx={{ gridColumn: 'span 12', textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">All widgets hidden — use "Manage widgets" to bring them back.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
