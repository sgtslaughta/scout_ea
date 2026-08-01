import { Suspense, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { X } from 'lucide-react'
import { DRAWERS } from './drawerRegistry'
import type { DrawerDef } from './drawerRegistry'

interface DrawerHostProps {
  activeDrawer: DrawerDef['id'] | null
  onClose: () => void
}

const fallback = (
  <Box sx={{ p: 4, color: 'text.secondary', fontSize: 14 }}>Loading…</Box>
)

export function DrawerHost({ activeDrawer, onClose }: DrawerHostProps) {
  const def = activeDrawer ? DRAWERS.find(d => d.id === activeDrawer) : undefined

  // Bump a counter each time a drawer opens so the child gets a fresh `key`
  // and remounts instead of reusing a stale instance from a previous open —
  // the hosted views run mount-only data-fetching effects.
  const openCount = useRef(0)
  const lastOpened = useRef<DrawerDef['id'] | null>(null)
  if (activeDrawer && activeDrawer !== lastOpened.current) {
    openCount.current += 1
    lastOpened.current = activeDrawer
  }
  if (!activeDrawer) {
    lastOpened.current = null
  }

  if (!def) return null

  const Component = def.component
  const content = (
    <Suspense fallback={fallback}>
      <Component key={`${def.id}-${openCount.current}`} />
    </Suspense>
  )

  if (def.kind === 'dialog') {
    return (
      <Dialog
        open
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        aria-label={def.label}
        // Tall and wide: these host MUI DataGrids, which need real room to be
        // usable — the 480px side drawer squashed them unusably.
        slotProps={{ paper: { sx: { height: '90vh' } } }}
      >
        <DrawerHeader label={def.label} onClose={onClose} />
        <Box sx={{ px: 3, pb: 3, flex: 1, minHeight: 0, overflow: 'auto' }}>{content}</Box>
      </Dialog>
    )
  }

  return (
    <Drawer
      open
      anchor="right"
      onClose={onClose}
      aria-label={def.label}
      slotProps={{
        paper: {
          sx: { width: { xs: '100vw', sm: 480 } },
        },
      }}
    >
      <DrawerHeader label={def.label} onClose={onClose} />
      <Box sx={{ px: 3, pb: 3 }}>{content}</Box>
    </Drawer>
  )
}

function DrawerHeader({ label, onClose }: { label: string; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <IconButton ref={ref} onClick={onClose} aria-label="Close" size="medium">
        <X size={22} />
      </IconButton>
    </Box>
  )
}
