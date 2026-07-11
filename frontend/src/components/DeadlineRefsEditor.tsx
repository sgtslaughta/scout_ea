import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Typography, Chip, TextField, MenuItem, Button } from '@mui/material'
import {
  addDeadlineLink, deleteDeadlineLink, addDeadlineTag, deleteDeadlineTag,
  getPeople, getTasks, getEvents, type Deadline, type DeadlineLink,
} from '@/api'
import { toast } from 'sonner'

const REF_TYPES = [
  { value: 'person', label: 'Person' },
  { value: 'task', label: 'Task' },
  { value: 'event', label: 'Event' },
] as const

/** References & tags editor for an existing deadline. Self-contained: mutates
 *  then invalidates ['deadlines'] so the parent row/modal refresh reactively. */
export function DeadlineRefsEditor({ deadline }: { deadline: Deadline }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['deadlines'] })
  const [refType, setRefType] = useState<DeadlineLink['ref_type']>('person')
  const [refId, setRefId] = useState<number | ''>('')
  const [tag, setTag] = useState('')

  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople() })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: getTasks })
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: getEvents })

  const options = refType === 'person'
    ? people.map((p) => ({ id: p.id, label: p.name }))
    : refType === 'task'
      ? tasks.map((t) => ({ id: t.id, label: t.title }))
      : events.map((e) => ({ id: e.id, label: e.title }))

  const addLink = useMutation({
    mutationFn: () => addDeadlineLink(deadline.id, refType, refId as number),
    onSuccess: () => { invalidate(); setRefId('') },
    onError: () => toast.error('Failed to add reference'),
  })
  const delLink = useMutation({
    mutationFn: (linkId: number) => deleteDeadlineLink(deadline.id, linkId),
    onSuccess: invalidate,
  })
  const addTagM = useMutation({
    mutationFn: (t: string) => addDeadlineTag(deadline.id, t),
    onSuccess: () => { invalidate(); setTag('') },
    onError: () => toast.error('Failed to add tag'),
  })
  const delTag = useMutation({
    mutationFn: (tagId: number) => deleteDeadlineTag(deadline.id, tagId),
    onSuccess: invalidate,
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
      <Typography variant="overline" color="text.secondary">References</Typography>
      {(deadline.links?.length ?? 0) > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {deadline.links!.map((l) => (
            <Chip key={l.id} size="small" label={`${l.ref_type}: ${l.label}`} onDelete={() => delLink.mutate(l.id)} />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          select size="small" label="Type" value={refType}
          onChange={(e) => { setRefType(e.target.value as DeadlineLink['ref_type']); setRefId('') }}
          sx={{ minWidth: 110 }}
        >
          {REF_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label="Item" value={refId}
          onChange={(e) => setRefId(Number(e.target.value))} sx={{ flex: 1 }}
          slotProps={{ htmlInput: { 'aria-label': 'Reference item' } }}
        >
          {options.length === 0
            ? <MenuItem value="" disabled>None available</MenuItem>
            : options.map((o) => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
        </TextField>
        <Button size="small" variant="outlined" disabled={refId === '' || addLink.isPending} onClick={() => addLink.mutate()}>
          Link
        </Button>
      </Box>

      <Typography variant="overline" color="text.secondary">Tags</Typography>
      {(deadline.tags?.length ?? 0) > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {deadline.tags!.map((t) => (
            <Chip key={t.id} size="small" variant="outlined" label={t.tag} onDelete={() => delTag.mutate(t.id)} />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small" label="Add tag" value={tag} fullWidth
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && tag.trim()) { e.preventDefault(); addTagM.mutate(tag.trim()) } }}
        />
        <Button size="small" variant="outlined" disabled={!tag.trim() || addTagM.isPending} onClick={() => addTagM.mutate(tag.trim())}>
          Add
        </Button>
      </Box>
    </Box>
  )
}
