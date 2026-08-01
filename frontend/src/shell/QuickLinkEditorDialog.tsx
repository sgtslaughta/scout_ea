import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField, Button,
  IconButton, Typography, List, ListItem, ListItemText,
} from '@mui/material'
import { Pencil, Trash2 } from 'lucide-react'
import type { QuickLink } from '@/api'
import { safeHttpUrl } from '@/lib/url'

export interface QuickLinkEditorDialogProps {
  open: boolean
  onClose: () => void
  links: QuickLink[]
  onAdd: (link: QuickLink) => void | Promise<void>
  onEdit: (originalName: string, link: QuickLink) => void | Promise<void>
  onRemove: (name: string) => void | Promise<void>
}

export function QuickLinkEditorDialog({
  open, onClose, links, onAdd, onEdit, onRemove,
}: QuickLinkEditorDialogProps) {
  const [editingName, setEditingName] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => { setEditingName(null); setName(''); setUrl(''); setError(null) }

  const startEdit = (link: QuickLink) => {
    setEditingName(link.name)
    setName(link.name)
    setUrl(link.url)
    setError(null)
  }

  // Most people type "msx.microsoft.com" or "localhost:5174", not a full URL.
  // Assume https:// when no scheme is given rather than rejecting it.
  const normalizeUrl = (raw: string): string => {
    const t = raw.trim()
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t) ? t : `https://${t}`
  }

  const validate = (): string | null => {
    if (!name.trim()) return 'Give the link a name first.'
    if (!url.trim()) return 'Add the web address this link should open.'
    // Names are this list's identity — they key the tiles and drive edit/remove,
    // so two links sharing one name makes both ambiguous.
    const clash = links.some(
      (l) => l.name.toLowerCase() === name.trim().toLowerCase() && l.name !== editingName,
    )
    if (clash) return `You already have a link called "${name.trim()}". Try another name.`
    // safeHttpUrl also blocks javascript:/data: addresses.
    if (!safeHttpUrl(normalizeUrl(url))) {
      return "That doesn't look like a web address. Try something like msx.microsoft.com or http://localhost:5174"
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    const link = { name: name.trim(), url: normalizeUrl(url) }
    if (editingName != null) await onEdit(editingName, link)
    else await onAdd(link)
    resetForm()
  }

  const handleClose = () => { resetForm(); onClose() }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: '1.375rem' }}>Quick links</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {links.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            Add a link to get started.
          </Typography>
        ) : (
          <List disablePadding>
            {links.map((link) => (
              <ListItem
                key={link.name}
                disableGutters
                sx={{ py: 1 }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton aria-label={`Edit ${link.name}`} onClick={() => startEdit(link)}>
                      <Pencil size={20} />
                    </IconButton>
                    <IconButton aria-label={`Remove ${link.name}`} onClick={() => onRemove(link.name)}>
                      <Trash2 size={20} />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={link.name} secondary={link.url}
                  slotProps={{ primary: { sx: { fontSize: '1rem' } } }}
                />
              </ListItem>
            ))}
          </List>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name" value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { style: { fontSize: '1rem' } } }}
          />
          <TextField
            label="Link" value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={!!error} helperText={error ?? ' '}
            slotProps={{ htmlInput: { style: { fontSize: '1rem' } } }}
          />
          <Box>
            <Button variant="contained" size="large" onClick={handleSave}>
              {editingName != null ? 'Save changes' : 'Add link'}
            </Button>
            {editingName != null && (
              <Button size="large" sx={{ ml: 1 }} onClick={resetForm}>Cancel</Button>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button size="large" onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
