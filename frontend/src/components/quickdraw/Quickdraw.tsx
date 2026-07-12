import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, IconButton, Tooltip, Button, Chip } from '@mui/material'
import { Crosshair, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { listActions } from '@/api'
import { useQuickdrawPrefs } from './useQuickdrawPrefs'
import { NeedsResponseSection } from './NeedsResponseSection'
import { ApproachingSection } from './ApproachingSection'
import { RecentActivitySection } from './RecentActivitySection'
import { TimersSection } from './TimersSection'

export function Quickdraw() {
  const navigate = useNavigate()
  const { expanded, toggleExpanded, isCollapsed, toggleSection } = useQuickdrawPrefs()
  const { data: actions = [] } = useQuery({
    queryKey: ['actions'],
    queryFn: () => listActions(),
    refetchInterval: 10000,
  })

  const pendingCount = actions.filter((a) => a.status === 'drafted' && a.mode === 'review').length

  return (
    <Box sx={{ width: expanded ? 560 : 300, borderLeft: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default', transition: 'width 0.15s ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Crosshair size={16} style={{ color: 'var(--color-accent)' }} />
        <Typography sx={{ flex: 1, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>QUICKDRAW</Typography>
        <Tooltip title={expanded ? 'Collapse Quickdraw' : 'Expand Quickdraw'}>
          <IconButton size="small" aria-label={expanded ? 'Collapse Quickdraw' : 'Expand Quickdraw'} onClick={toggleExpanded}>
            {expanded ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {pendingCount > 0 && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>Pending Actions</Typography>
              <Chip size="small" label={pendingCount} />
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate('/feed?view=actions')}
              fullWidth
            >
              Review in Actions
            </Button>
          </Box>
        )}
        <NeedsResponseSection expanded={expanded} collapsed={isCollapsed('needs')} onToggle={toggleSection} />
        <ApproachingSection expanded={expanded} collapsed={isCollapsed('approaching')} onToggle={toggleSection} />
        <RecentActivitySection collapsed={isCollapsed('recent')} onToggle={toggleSection} />
        <TimersSection collapsed={isCollapsed('timers')} onToggle={toggleSection} />
      </Box>
    </Box>
  )
}
