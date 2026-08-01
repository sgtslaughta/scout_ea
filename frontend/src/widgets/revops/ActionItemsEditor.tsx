import { useState } from 'react'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Plus, X } from 'lucide-react'
import type { RevOpsActionItem } from './types'

let seq = 0
const newItemId = () => `action-${Date.now()}-${seq++}`

/** Full add/edit/remove/tick editor for a month's post-meeting action items. */
export function ActionItemsEditor({ items, onChange }: {
  items: RevOpsActionItem[]
  onChange: (next: RevOpsActionItem[]) => void
}) {
  const [draftText, setDraftText] = useState('')

  const update = (id: string, patch: Partial<RevOpsActionItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id))
  const add = () => {
    const text = draftText.trim()
    if (!text) return
    onChange([...items, { id: newItemId(), text, done: false, source: 'user' }])
    setDraftText('')
  }

  return (
    <Stack spacing={1.5}>
      {items.length === 0 && (
        <Typography variant="body2" color="text.secondary">No action items yet — add the first one below.</Typography>
      )}
      {items.map((i) => (
        <Stack key={i.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Checkbox
            checked={i.done}
            onChange={(e) => update(i.id, { done: e.target.checked })}
            slotProps={{ input: { 'aria-label': `Ticked: ${i.text}` } }}
          />
          <TextField
            size="small"
            value={i.text}
            onChange={(e) => update(i.id, { text: e.target.value })}
            slotProps={{ htmlInput: { 'aria-label': 'Action item' } }}
            sx={{ flex: 1, minWidth: 140 }}
          />
          <TextField
            size="small"
            value={i.owner ?? ''}
            onChange={(e) => update(i.id, { owner: e.target.value })}
            placeholder="Owner"
            slotProps={{ htmlInput: { 'aria-label': `Owner for ${i.text}` } }}
            sx={{ minWidth: 100 }}
          />
          {i.taskAdded && <Typography variant="caption" color="text.secondary">Added to to-do</Typography>}
          <IconButton aria-label={`Remove action item ${i.text}`} size="small" onClick={() => remove(i.id)}>
            <X size={16} />
          </IconButton>
        </Stack>
      ))}
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="New action item"
          slotProps={{ htmlInput: { 'aria-label': 'New action item text' } }}
          sx={{ flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        />
        <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={add}>
          Add item
        </Button>
      </Stack>
    </Stack>
  )
}
