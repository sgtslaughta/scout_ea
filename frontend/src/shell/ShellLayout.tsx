import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import { CommandPalette } from '@/components/CommandPalette'
import { TopBar } from './TopBar'
import { LeftRail } from './LeftRail'
import { CenterGrid } from './CenterGrid'
import { RightRail } from './RightRail'
import { DrawerHost } from './DrawerHost'
import type { DrawerDef } from './drawerRegistry'

// Rails hide below `lg` rather than crushing the centre grid — same
// convention the old App.tsx used for its right drawer.
const RAIL_VISIBILITY = { xs: 'none', lg: 'flex' } as const
const RAIL_WIDTH = 320

export function ShellLayout() {
  const [activeDrawer, setActiveDrawer] = useState<DrawerDef['id'] | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const queryClient = useQueryClient()

  // ⌘K / Ctrl+K lives here rather than in App so the palette and the top-bar
  // icons drive the same `activeDrawer` state.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <Box sx={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', bgcolor: 'background.default', color: 'text.primary',
    }}
    >
      <TopBar onOpenDrawer={setActiveDrawer} />

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ display: RAIL_VISIBILITY, width: RAIL_WIDTH, flexShrink: 0, overflowY: 'auto' }}>
          <LeftRail />
        </Box>

        <Box sx={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Box className="texture-backdrop" aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
          <Box sx={{ position: 'relative', zIndex: 1, height: '100%', overflowY: 'auto' }}>
            <CenterGrid />
          </Box>
        </Box>

        <Box sx={{ display: RAIL_VISIBILITY, width: RAIL_WIDTH, flexShrink: 0, overflowY: 'auto' }}>
          <RightRail />
        </Box>
      </Box>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenDrawer={setActiveDrawer}
        onRefresh={() => queryClient.invalidateQueries()}
      />

      <DrawerHost activeDrawer={activeDrawer} onClose={() => setActiveDrawer(null)} />
    </Box>
  )
}
