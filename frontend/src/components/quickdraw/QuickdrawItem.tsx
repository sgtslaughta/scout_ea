import { useState, type ReactNode } from 'react'
import {
  Box, Typography, IconButton, Tooltip, Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogActions, Button,
} from '@mui/material'
import { MoreHorizontal } from 'lucide-react'

export interface QuickdrawAction { label: string; icon: ReactNode; onClick: () => void; destructive?: boolean }

interface QuickdrawItemProps {
  glyph: ReactNode
  title: string
  meta?: string
  detail?: string
  metaColor?: string
  actions: QuickdrawAction[]
  expanded: boolean
  onOpen?: () => void
}

export function QuickdrawItem({ glyph, title, meta, detail, metaColor, actions, expanded, onOpen }: QuickdrawItemProps) {
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null)
  const [confirm, setConfirm] = useState<QuickdrawAction | null>(null)

  const fire = (a: QuickdrawAction) => {
    setMenuEl(null)
    if (a.destructive) setConfirm(a)
    else a.onClick()
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, px: 1, py: 0.6, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
      <Box sx={{ mt: 0.25, flexShrink: 0, display: 'flex' }}>{glyph}</Box>
      <Box
        role="button" tabIndex={0} aria-label={title}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() } }}
        sx={{ flex: 1, minWidth: 0, cursor: onOpen ? 'pointer' : 'default', '&:focus-visible': { outline: '2px solid var(--color-accent)' } }}
      >
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{title}</Typography>
        {expanded && detail && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{detail}</Typography>
        )}
      </Box>
      {meta && (
        <Typography variant="caption" sx={{ flexShrink: 0, fontFamily: '"JetBrains Mono", monospace', color: metaColor ?? 'text.secondary', mt: 0.25 }}>{meta}</Typography>
      )}
      {actions.length > 0 && (expanded ? (
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          {actions.map((a) => (
            <Tooltip key={a.label} title={a.label}>
              <IconButton size="small" aria-label={a.label} onClick={() => fire(a)}>{a.icon}</IconButton>
            </Tooltip>
          ))}
        </Box>
      ) : (
        <>
          <IconButton size="small" aria-label="more actions" onClick={(e) => setMenuEl(e.currentTarget)}><MoreHorizontal size={16} /></IconButton>
          <Menu open={!!menuEl} anchorEl={menuEl} onClose={() => setMenuEl(null)}>
            {actions.map((a) => (
              <MenuItem key={a.label} onClick={() => fire(a)}>
                <ListItemIcon>{a.icon}</ListItemIcon>{a.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      ))}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm?.label} "{title}"?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => { confirm?.onClick(); setConfirm(null) }}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
