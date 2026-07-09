import { Component, createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import { RefreshCw, Maximize2, ArrowUpRight, EyeOff, ChevronUp, ChevronDown } from 'lucide-react'

const CountContext = createContext<(n: number | undefined) => void>(() => {})

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

interface WidgetCardProps {
  title: string
  drillDown?: string
  onRefresh: () => void
  onMove: (dir: -1 | 1) => void
  onHide: () => void
  children: ReactNode
}

export function WidgetCard({ title, drillDown, onRefresh, onMove, onHide, children }: WidgetCardProps) {
  const [count, setCount] = useState<number | undefined>(undefined)
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const actions = (
    <Box
      className="widget-actions"
      sx={{ display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s', '@media (hover: none)': { opacity: 1 } }}
    >
      <Tooltip title="Move up"><IconButton size="small" aria-label={`Move ${title} up`} onClick={() => onMove(-1)}><ChevronUp size={14} /></IconButton></Tooltip>
      <Tooltip title="Move down"><IconButton size="small" aria-label={`Move ${title} down`} onClick={() => onMove(1)}><ChevronDown size={14} /></IconButton></Tooltip>
      <Tooltip title="Refresh"><IconButton size="small" aria-label={`Refresh ${title}`} onClick={onRefresh}><RefreshCw size={14} /></IconButton></Tooltip>
      <Tooltip title="Expand"><IconButton size="small" aria-label={`Expand ${title}`} onClick={() => setExpanded(true)}><Maximize2 size={14} /></IconButton></Tooltip>
      {drillDown && (
        <Tooltip title="Open view"><IconButton size="small" aria-label={`Open ${title}`} onClick={() => navigate(drillDown)}><ArrowUpRight size={14} /></IconButton></Tooltip>
      )}
      <Tooltip title="Hide"><IconButton size="small" aria-label={`Hide ${title}`} onClick={onHide}><EyeOff size={14} /></IconButton></Tooltip>
    </Box>
  )

  return (
    <CountContext.Provider value={setCount}>
      <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%', '&:hover .widget-actions': { opacity: 1 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 1, minHeight: 36 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>{title}</Typography>
          {count !== undefined && <Chip size="small" label={count} sx={{ height: 18, fontSize: 11 }} />}
          <Box sx={{ flex: 1 }} />
          {actions}
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, p: 1 }}>
          <WidgetErrorBoundary title={title}>{children}</WidgetErrorBoundary>
        </Box>
      </Paper>
      <Dialog open={expanded} onClose={() => setExpanded(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <WidgetErrorBoundary title={title}>{expanded && children}</WidgetErrorBoundary>
        </DialogContent>
      </Dialog>
    </CountContext.Provider>
  )
}
