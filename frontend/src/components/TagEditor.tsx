import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Typography, TextField, MenuItem, Button, Autocomplete } from '@mui/material'
import {
  getContentRefs, getTags, tagContent, untagContent, linkContent, unlinkContent,
  getPeople, getTopics, type ContentRefs,
} from '@/api'
import { COLOR_KEYS } from '@/lib/tagColors'
import { TagChips } from './TagChips'
import { toast } from 'sonner'

const TARGET_TYPES = [{ value: 'person', label: 'Person' }, { value: 'topic', label: 'Topic' }] as const

/** Universal tag + link editor for any content row. Self-contained: mutates then
 *  invalidates ['content-refs', refType, refId] (and ['deadlines'] etc. via prefix). */
export function TagEditor({ refType, refId }: { refType: string; refId: number }) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['content-refs', refType, refId] })
    qc.invalidateQueries({ queryKey: [`${refType}s`] })  // e.g. ['deadlines'] row enrichment
  }
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('neutral')
  const [targetType, setTargetType] = useState<'person' | 'topic'>('person')
  const [targetId, setTargetId] = useState<number | ''>('')

  const { data: refs = { tags: [], links: [] } as ContentRefs } = useQuery({
    queryKey: ['content-refs', refType, refId], queryFn: () => getContentRefs(refType, refId),
  })
  const { data: allTags = [] } = useQuery({ queryKey: ['tags'], queryFn: getTags })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople() })
  const { data: topics = [] } = useQuery({ queryKey: ['topics'], queryFn: () => getTopics() })

  const targetOptions = targetType === 'person'
    ? people.map((p) => ({ id: p.id, label: p.name }))
    : topics.map((t) => ({ id: t.id, label: t.name }))

  const addTag = useMutation({
    mutationFn: () => tagContent(refType, refId, tagName.trim(), tagColor),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['tags'] }); setTagName('') },
    onError: () => toast.error('Failed to add tag'),
  })
  const rmTag = useMutation({
    mutationFn: (tagId: number) => untagContent(refType, refId, tagId), onSuccess: invalidate,
  })
  const addLink = useMutation({
    mutationFn: () => linkContent(refType, refId, targetType, targetId as number),
    onSuccess: () => { invalidate(); setTargetId('') },
    onError: () => toast.error('Failed to add link'),
  })
  const rmLink = useMutation({
    mutationFn: (linkId: number) => unlinkContent(refType, refId, linkId), onSuccess: invalidate,
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
      <Typography variant="overline" color="text.secondary">Tags & links</Typography>
      {(refs.tags.length > 0 || refs.links.length > 0) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          {refs.links.map((l) => (
            <TagChips key={`L${l.id}`} links={[l]} onLinkClick={() => rmLink.mutate(l.id)} />
          ))}
          {refs.tags.map((t) => (
            <TagChips key={`T${t.tag_id}`} tags={[t]} onTagClick={() => rmTag.mutate(t.tag_id)} />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Autocomplete
          freeSolo size="small" sx={{ flex: 1 }} options={allTags.map((t) => t.name)} inputValue={tagName}
          onInputChange={(_e, v) => setTagName(v)}
          renderInput={(params) => <TextField {...params} label="Tag" />}
        />
        <TextField
          select size="small" label="Color" value={tagColor} onChange={(e) => setTagColor(e.target.value)}
          sx={{ minWidth: 100 }} slotProps={{ htmlInput: { 'aria-label': 'Tag color' } }}
        >
          {COLOR_KEYS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
        </TextField>
        <Button size="small" variant="outlined" disabled={!tagName.trim() || addTag.isPending} onClick={() => addTag.mutate()}>
          Tag
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          select size="small" label="Link to" value={targetType}
          onChange={(e) => { setTargetType(e.target.value as 'person' | 'topic'); setTargetId('') }}
          sx={{ minWidth: 110 }}
        >
          {TARGET_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label="Item" value={targetId} sx={{ flex: 1 }}
          onChange={(e) => setTargetId(Number(e.target.value))}
          slotProps={{ htmlInput: { 'aria-label': 'Link item' } }}
        >
          {targetOptions.length === 0
            ? <MenuItem value="" disabled>None available</MenuItem>
            : targetOptions.map((o) => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
        </TextField>
        <Button size="small" variant="outlined" disabled={targetId === '' || addLink.isPending} onClick={() => addLink.mutate()}>
          Link
        </Button>
      </Box>
    </Box>
  )
}
