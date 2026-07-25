import type { ReactNode } from 'react'
import { Paper, Popper } from '@mui/material'

export interface HoverCardProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * Hover popover whose paper is itself hoverable, and which never steals focus.
 * Built on Popper (not Popover/Modal) — Popper has no focus trap and does not
 * mark the rest of the page aria-hidden, so a keyboard user can focus the
 * anchor and still read the card without the anchor itself being hidden.
 */
export function HoverCard({ anchorEl, open, onClose, children }: HoverCardProps) {
  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="bottom-start"
      sx={{ zIndex: (theme) => theme.zIndex.tooltip, pointerEvents: 'none' }}
    >
      <Paper
        onMouseLeave={onClose}
        sx={{ pointerEvents: 'auto', p: 1.5, maxWidth: 380 }}
      >
        {children}
      </Paper>
    </Popper>
  )
}
