import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography } from '@mui/material'
import { toast } from 'sonner'

// ponytail: FE stub. When the response-actions skill lands, POST this gist to the
// future /api/action-requests table instead of only toasting.
export function ActionComposeModal({ open, title, onClose }: { open: boolean; title: string; onClose: () => void }) {
  const [gist, setGist] = useState('')
  const submit = () => {
    toast.success('Queued for the response skill — coming soon')
    setGist('')
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Describe what you want done. An upcoming skill will pick this up and draft it.
        </Typography>
        <TextField
          label="What should happen?" value={gist} onChange={(e) => setGist(e.target.value)}
          autoFocus multiline rows={4} fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!gist.trim()}>Queue it</Button>
      </DialogActions>
    </Dialog>
  )
}
