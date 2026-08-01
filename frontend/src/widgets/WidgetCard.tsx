import { Component, createContext, useContext, useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Paper from '@mui/material/Paper'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Popover from '@mui/material/Popover'
import { RefreshCw, Maximize2, ArrowUpRight, EyeOff, GripVertical, Settings as SettingsIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'

const CountContext = createContext<(n: number | undefined) => void>(() => {})

const ExpandedContext = createContext(false)

/**
 * True while the tile is rendering inside its expand dialog rather than in the
 * grid. Tiles that cap their list for the compact view use this to show the
 * full set when expanded — without it, expanding shows the same truncated list
 * and the action is pointless.
 */
export function useWidgetExpanded(): boolean {
  return useContext(ExpandedContext)
}

/** Child widgets publish their live item count into the chrome chip. */
export function useWidgetCount(count: number | undefined) {
  const setCount = useContext(CountContext)
  useEffect(() => {
    setCount(count)
    return () => setCount(undefined)
  }, [count, setCount])
}

class WidgetErrorBoundary extends Component<{ title: string; children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <Alert severity="error" sx={{ m: 1 }}>
          {this.props.title} failed to load: {this.state.error.message}
        </Alert>
      )
    }
    return this.props.children
  }
}

/** Props a dnd-kit `useSortable` grid attaches to expose the drag handle. */
export interface DragHandleProps {
  attributes?: DraggableAttributes
  listeners?: DraggableSyntheticListeners
  setActivatorNodeRef?: (element: HTMLElement | null) => void
}

interface WidgetCardProps {
  title: string
  drillDown?: string | (() => void)
  onRefresh: () => void
  onHide: () => void
  dragHandle?: DragHandleProps
  emptyState?: { icon?: LucideIcon; message: string }
  settings?: ComponentType
  children: ReactNode
}

export function WidgetCard({ title, drillDown, onRefresh, onHide, dragHandle, emptyState, settings: Settings, children }: WidgetCardProps) {
  const [count, setCount] = useState<number | undefined>(undefined)
  const [expanded, setExpanded] = useState(false)
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null)
  const navigate = useNavigate()

  const openDrillDown = () => {
    if (typeof drillDown === 'function') drillDown()
    else if (drillDown) navigate(drillDown)
  }

  const isEmpty = count === 0 && !!emptyState
  const EmptyIcon = emptyState?.icon

  const actions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        className="widget-actions"
        sx={{ display: 'flex', gap: 0.5, opacity: 0, transition: 'opacity 0.15s', '@media (hover: none)': { opacity: 1 } }}
      >
        {Settings && (
          <Tooltip title="Settings">
            <IconButton aria-label={`Settings for ${title}`} onClick={(e) => setSettingsAnchor(e.currentTarget)}>
              <SettingsIcon size={18} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Refresh"><IconButton aria-label={`Refresh ${title}`} onClick={onRefresh}><RefreshCw size={18} /></IconButton></Tooltip>
        <Tooltip title="Expand"><IconButton aria-label={`Expand ${title}`} onClick={() => setExpanded(true)}><Maximize2 size={18} /></IconButton></Tooltip>
        {drillDown && (
          <Tooltip title="Open view"><IconButton aria-label={`Open ${title}`} onClick={openDrillDown}><ArrowUpRight size={18} /></IconButton></Tooltip>
        )}
        <Tooltip title="Hide"><IconButton aria-label={`Hide ${title}`} onClick={onHide}><EyeOff size={18} /></IconButton></Tooltip>
      </Box>
      {/* Last in the row, per request. Stays always-visible rather than joining
          .widget-actions: a hover-gated handle is unreachable by keyboard. The
          hover box uses opacity, not display, so its slot is reserved and the
          grip never shifts as the other actions fade in. */}
      <Tooltip title="Reorder">
        <IconButton
          aria-label={`Reorder ${title}`}
          aria-roledescription="sortable"
          ref={dragHandle?.setActivatorNodeRef}
          {...dragHandle?.attributes}
          {...dragHandle?.listeners}
        >
          <GripVertical size={18} />
        </IconButton>
      </Tooltip>
    </Box>
  )

  // Children stay mounted even when isEmpty, just visually hidden: unmounting
  // them would tear down the effect that reported count === 0 in the first
  // place, flipping isEmpty back to false and causing a remount/hide loop.
  const body = (
    <>
      {isEmpty && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, color: 'text.secondary', textAlign: 'center', px: 2 }}>
          {EmptyIcon && <EmptyIcon size={28} aria-hidden="true" />}
          <Typography variant="body1" color="text.secondary">{emptyState!.message}</Typography>
        </Box>
      )}
      <Box sx={{ display: isEmpty ? 'none' : 'contents' }}>{children}</Box>
    </>
  )

  return (
    <CountContext.Provider value={setCount}>
      <Paper
        variant="outlined"
        sx={(t) => ({
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          borderColor: 'divider',
          transition: 'box-shadow 160ms, border-color 160ms, transform 160ms',
          // Lift toward the theme's own accent on hover rather than a grey
          // shadow, so each theme keeps its character.
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: `0 6px 20px -8px ${t.vars ? `rgba(${t.vars.palette.primary.mainChannel} / 0.45)` : alpha(t.palette.primary.main, 0.45)}`,
          },
          '&:hover .widget-actions': { opacity: 1 },
        })}
      >
        <Box
          sx={(t) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            pt: 2,
            pb: 1.5,
            minHeight: 48,
            // Tinted header band + accent underline, both derived from the
            // active theme's primary so all five themes read differently.
            background: t.vars
              ? `linear-gradient(180deg, rgba(${t.vars.palette.primary.mainChannel} / 0.07), rgba(${t.vars.palette.primary.mainChannel} / 0))`
              : `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.07)}, transparent)`,
            borderBottom: '1px solid',
            borderColor: t.vars
              ? `rgba(${t.vars.palette.primary.mainChannel} / 0.22)`
              : alpha(t.palette.primary.main, 0.22),
          })}
        >
          <Box
            aria-hidden
            sx={{ width: 3, height: 18, borderRadius: 1, bgcolor: 'primary.main', flexShrink: 0 }}
          />
          <Typography variant="h6" color="text.primary" sx={{ lineHeight: 1.2 }}>{title}</Typography>
          {count !== undefined && <Chip size="small" label={count} sx={{ height: 22, fontSize: 13 }} />}
          <Box sx={{ flex: 1 }} />
          {actions}
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, p: 2.5 }}>
          <WidgetErrorBoundary title={title}>
            <ExpandedContext.Provider value={false}>{body}</ExpandedContext.Provider>
          </WidgetErrorBoundary>
        </Box>
      </Paper>
      <Dialog open={expanded} onClose={() => setExpanded(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <WidgetErrorBoundary title={title}>
            {expanded && <ExpandedContext.Provider value>{body}</ExpandedContext.Provider>}
          </WidgetErrorBoundary>
        </DialogContent>
      </Dialog>
      {Settings && (
        <Popover open={!!settingsAnchor} anchorEl={settingsAnchor} onClose={() => setSettingsAnchor(null)}>
          <Box sx={{ p: 2.5, minWidth: 240 }}>
            <Settings />
          </Box>
        </Popover>
      )}
    </CountContext.Provider>
  )
}
