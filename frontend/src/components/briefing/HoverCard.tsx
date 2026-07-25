import type { ReactNode } from 'react'
import { Popover } from '@mui/material'

export interface HoverCardProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  children: ReactNode
}

/** Hover popover whose paper is itself hoverable, and which never steals focus. */
export function HoverCard({ anchorEl, open, onClose, children }: HoverCardProps) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          onMouseLeave: onClose,
          sx: { pointerEvents: 'auto', p: 1.5, maxWidth: 380 },
        },
      }}
      disableRestoreFocus
    >
      {children}
    </Popover>
  )
}
