import { useEffect, useRef, useState } from 'react'
import { Box, Chip, Popover } from '@mui/material'
import type { QuickLink } from '@/api'
import { QuickLinkTile } from './QuickLinkTile'

export function QuickLinksOverflow({ links }: { links: QuickLink[] }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)

  // Popover opens on hover with a short close delay so the pointer can
  // travel from the chip into the (portaled) popover paper without it
  // closing mid-transit — same pattern as FinanceStrip's ticker popover.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  useEffect(() => clearCloseTimer, [])
  const scheduleClose = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setAnchorEl(null), 120)
  }

  if (links.length === 0) return null

  return (
    <Box onMouseLeave={scheduleClose}>
      <Chip
        role="button"
        label={`+${links.length} more`}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        onMouseEnter={(e) => { clearCloseTimer(); setAnchorEl(e.currentTarget) }}
        onFocus={(e) => setAnchorEl(e.currentTarget)}
        variant="outlined"
        sx={{ fontSize: '1rem', height: 'auto', py: 1 }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        disableRestoreFocus
        slotProps={{
          paper: {
            onMouseEnter: clearCloseTimer,
            onMouseLeave: scheduleClose,
            sx: { maxHeight: 320, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 },
          },
        }}
      >
        {links.map((link) => (
          <QuickLinkTile key={link.name} link={link} />
        ))}
      </Popover>
    </Box>
  )
}
