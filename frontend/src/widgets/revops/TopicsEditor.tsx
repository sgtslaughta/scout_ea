import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Plus, X } from 'lucide-react'
import type { RevOpsTopic } from './types'

let seq = 0
const newTopicId = () => `topic-${Date.now()}-${seq++}`

/** Full add/edit/remove editor for a month's topic list, used in the expand dialog. */
export function TopicsEditor({ topics, onChange }: {
  topics: RevOpsTopic[]
  onChange: (next: RevOpsTopic[]) => void
}) {
  const [draftTitle, setDraftTitle] = useState('')

  const update = (id: string, patch: Partial<RevOpsTopic>) =>
    onChange(topics.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  // Overwriting the speaker clears its provenance — the user's typed value is now authoritative.
  const updateSpeaker = (id: string, speaker: string) =>
    onChange(topics.map((t) => (t.id === id ? { ...t, speaker, speakerSource: undefined } : t)))
  const remove = (id: string) => onChange(topics.filter((t) => t.id !== id))
  const add = () => {
    const title = draftTitle.trim()
    if (!title) return
    onChange([...topics, { id: newTopicId(), title, onAgenda: true }])
    setDraftTitle('')
  }

  return (
    <Stack spacing={1.5}>
      {topics.length === 0 && (
        <Typography variant="body2" color="text.secondary">No topics yet — add the first one below.</Typography>
      )}
      {topics.map((t) => (
        <Stack key={t.id} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Checkbox
            checked={t.onAgenda}
            onChange={(e) => update(t.id, { onAgenda: e.target.checked })}
            slotProps={{ input: { 'aria-label': `On agenda: ${t.title}` } }}
          />
          <TextField
            size="small"
            value={t.title}
            onChange={(e) => update(t.id, { title: e.target.value })}
            slotProps={{ htmlInput: { 'aria-label': 'Topic title' } }}
            sx={{ flex: 1, minWidth: 120 }}
          />
          <Box sx={{ flex: 1, minWidth: 140 }}>
            <TextField
              size="small"
              fullWidth
              value={t.speaker ?? ''}
              onChange={(e) => updateSpeaker(t.id, e.target.value)}
              slotProps={{ htmlInput: { 'aria-label': `Speaker for ${t.title}` } }}
              placeholder="Speaker"
            />
            {t.speakerSource && (
              <Typography variant="caption" color="text.secondary">from {t.speakerSource}</Typography>
            )}
          </Box>
          <IconButton aria-label={`Remove topic ${t.title}`} size="small" onClick={() => remove(t.id)}>
            <X size={16} />
          </IconButton>
        </Stack>
      ))}
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="New topic"
          slotProps={{ htmlInput: { 'aria-label': 'New topic title' } }}
          sx={{ flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        />
        <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={add}>
          Add topic
        </Button>
      </Stack>
    </Stack>
  )
}
