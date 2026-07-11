import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { Crosshair, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { useQuickdrawPrefs } from './useQuickdrawPrefs'
import { NeedsResponseSection } from './NeedsResponseSection'
import { ApproachingSection } from './ApproachingSection'
import { RecentActivitySection } from './RecentActivitySection'

export function Quickdraw() {
  const { expanded, toggleExpanded, isCollapsed, toggleSection } = useQuickdrawPrefs()
  return (
    <Box sx={{ width: expanded ? 560 : 300, borderLeft: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default', transition: 'width 0.15s ease' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Crosshair size={16} style={{ color: 'var(--color-accent)' }} />
        <Typography sx={{ flex: 1, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>QUICKDRAW</Typography>
        <Tooltip title={expanded ? 'Collapse Quickdraw' : 'Expand Quickdraw'}>
          <IconButton size="small" aria-label={expanded ? 'Collapse Quickdraw' : 'Expand Quickdraw'} onClick={toggleExpanded}>
            {expanded ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <NeedsResponseSection expanded={expanded} collapsed={isCollapsed('needs')} onToggle={toggleSection} />
        <ApproachingSection expanded={expanded} collapsed={isCollapsed('approaching')} onToggle={toggleSection} />
        <RecentActivitySection collapsed={isCollapsed('recent')} onToggle={toggleSection} />
      </Box>
    </Box>
  )
}
