import Drawer from '@mui/material/Drawer'
import { TimersPanel } from './TimersPanel'

export function TimersDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <TimersPanel />
    </Drawer>
  )
}
