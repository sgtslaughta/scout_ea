import { Link as RouterLink } from 'react-router-dom'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

interface HelpDialogProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: Array<[string, string]> = [
  ['⌘K', 'Open the command palette'],
  ['Esc', 'Close dialogs and overlays'],
]

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="img" src="/scout_ea_logo_64.png" alt="" sx={{ width: 28, height: 28, flexShrink: 0 }} />
        Scout EA — Help
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Scout EA is your executive-assistant dashboard — signals, tasks, deadlines and
          trends in one place.
        </Typography>
        <Typography variant="overline" color="text.secondary">Keyboard shortcuts</Typography>
        <Stack spacing={0.5} sx={{ my: 1 }}>
          {SHORTCUTS.map(([key, desc]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', minWidth: 40 }}>{key}</Typography>
              <Typography variant="body2" color="text.secondary">{desc}</Typography>
            </Box>
          ))}
        </Stack>
        <Link component={RouterLink} to="/skills" onClick={onClose} variant="body2">
          Open skills library
        </Link>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
