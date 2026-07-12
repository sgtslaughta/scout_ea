import { useState } from 'react'
import { IconButton, Popover, Box, Typography, TextField, Button, Stack, Tooltip } from '@mui/material'
import { StickyNote } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGuidance, addGuidance } from '../../api'

export function GuidancePopover({ scope }: { scope: string }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [text, setText] = useState('')
  const qc = useQueryClient()
  const { data: notes = [] } = useQuery({
    queryKey: ['guidance', scope], queryFn: () => getGuidance(scope), enabled: !!anchor,
  })
  const add = useMutation({
    mutationFn: () => addGuidance(scope, text),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['guidance', scope] }) },
  })

  return (
    <>
      <Tooltip title="Guidance">
        <IconButton size="small" aria-label="Guidance" onClick={(e) => setAnchor(e.currentTarget)}>
          <StickyNote size={16} />
        </IconButton>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>
        <Box sx={{ p: 2, width: 300, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">Notes Scout will honor for {scope}</Typography>
          <Stack spacing={0.5}>
            {notes.map((n) => <Typography key={n.id} variant="body2">• {n.text}</Typography>)}
          </Stack>
          <TextField label="New note" value={text} onChange={(e) => setText(e.target.value)}
            size="small" multiline rows={2} fullWidth slotProps={{ input: { 'aria-label': 'note' } }} />
          <Button size="small" variant="contained" disabled={!text.trim()} onClick={() => add.mutate()}>Add</Button>
        </Box>
      </Popover>
    </>
  )
}
