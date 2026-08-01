import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import type { SelectChangeEvent } from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Send, Link as LinkIcon, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { addRecord, createAction, createTask, getRecords } from '@/api'
import { useWidgetCount, useWidgetExpanded } from './WidgetCard'
import { TopicsEditor } from './revops/TopicsEditor'
import { ActionItemsEditor } from './revops/ActionItemsEditor'
import { buildAgendaText, buildRecapText } from './revops/agenda'
import { currentMonth, monthLabel, monthOptions } from './revops/months'
import { parseRevOpsRecord, toDataBlob, type RevOpsData } from './revops/types'

const externalRef = (month: string) => `revops:${month}`

export default function RevOpsTile() {
  const qc = useQueryClient()
  const expanded = useWidgetExpanded()
  const [month, setMonth] = useState(() => currentMonth())

  const { data: records = [] } = useQuery({
    queryKey: ['records', 'revops_meeting'],
    queryFn: () => getRecords('revops_meeting'),
    refetchInterval: 15000,
  })

  const record = useMemo(() => records.find((r) => r.external_ref === externalRef(month)), [records, month])
  const data = useMemo(() => parseRevOpsRecord(record, month), [record, month])

  // "How much is on my plate for this meeting" == the ticked agenda, not the full topic list.
  useWidgetCount(data.topics.filter((t) => t.onAgenda).length)

  const saveMutation = useMutation({
    // Every save spreads the full current RevOpsData so a single-field edit
    // can never wipe the rest of the month's blob — POST /api/records
    // replaces the whole data blob on upsert.
    mutationFn: (next: RevOpsData) =>
      addRecord('revops_meeting', externalRef(month), toDataBlob(next), record?.status ?? 'active', record?.sort ?? 0),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', 'revops_meeting'] }),
    onError: () => toast.error('Failed to save RevOps meeting'),
  })
  const save = (next: RevOpsData) => saveMutation.mutate(next)

  const sendAgenda = async () => {
    const ticked = data.topics.filter((t) => t.onAgenda)
    await createAction({
      action_type: 'teams_post',
      mode: 'review',
      payload: {
        recipients: 'RevOps team',
        message: buildAgendaText(month, data.topics),
        topics: ticked.map((t) => ({ title: t.title, speaker: t.speaker })),
      },
      approve: false,
    })
    toast.success('Agenda queued for Teams — review it in your Actions queue')
  }

  const postRecapLink = async () => {
    if (!data.graceUrl) {
      toast.error('No GRACE link set for this meeting yet — add one before posting.')
      return
    }
    await createAction({
      action_type: 'teams_post',
      mode: 'review',
      payload: { recipients: 'RevOps team', message: `Recap and action items for the ${monthLabel(month)} RevOps meeting: ${data.graceUrl}` },
      approve: false,
    })
    toast.success('Recap link queued for Teams — review it in your Actions queue')
  }

  const copyRecap = async () => {
    await navigator.clipboard.writeText(buildRecapText(month, data.recapText, data.actionItems))
    toast.success('Recap copied for GRACE')
  }

  const addTicketedToTasks = async () => {
    const toAdd = data.actionItems.filter((i) => i.done && !i.taskAdded)
    if (toAdd.length === 0) {
      toast.info('No new ticked action items to add.')
      return
    }
    for (const item of toAdd) {
      await createTask({ title: item.text, detail: item.owner ? `RevOps action item — owner: ${item.owner}` : 'RevOps action item' })
    }
    const addedIds = new Set(toAdd.map((i) => i.id))
    save({ ...data, actionItems: data.actionItems.map((i) => (addedIds.has(i.id) ? { ...i, taskAdded: true } : i)) })
    toast.success(`Added ${toAdd.length} item${toAdd.length > 1 ? 's' : ''} to your to-do list`)
  }

  const meetingDateField = (
    <Stack spacing={0.5}>
      <TextField
        size="small"
        type="datetime-local"
        label="Meeting date"
        value={data.meetingAt ? data.meetingAt.slice(0, 16) : ''}
        onChange={(e) => save({ ...data, meetingAt: e.target.value ? new Date(e.target.value).toISOString() : null, meetingSource: 'manual' })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Typography variant="caption" color="text.secondary">
        {data.meetingAt ? (data.meetingSource === 'calendar' ? 'From your calendar' : 'Set manually') : 'No meeting found yet for this month'}
      </Typography>
    </Stack>
  )

  const monthSelect = (
    <Select
      size="small"
      value={month}
      onChange={(e: SelectChangeEvent) => setMonth(e.target.value)}
      aria-label="Month"
    >
      {monthOptions(currentMonth()).map((m) => (
        <MenuItem key={m} value={m}>{monthLabel(m)}</MenuItem>
      ))}
    </Select>
  )

  const teamsButtons = (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Button size="small" variant="outlined" startIcon={<Send size={16} />} onClick={sendAgenda}>
        Send agenda to Teams
      </Button>
      <Button size="small" variant="outlined" startIcon={<LinkIcon size={16} />} onClick={postRecapLink}>
        Post recap link to Teams
      </Button>
    </Stack>
  )

  if (!expanded) {
    const ticked = data.topics.filter((t) => t.onAgenda)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5 }}>
        {monthSelect}
        {meetingDateField}
        <Stack spacing={0.5} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {ticked.length === 0 && <Typography variant="body2" color="text.secondary">No topics on the agenda yet.</Typography>}
          {ticked.slice(0, 3).map((t) => (
            <Typography key={t.id} variant="body2">{t.title}{t.speaker ? ` — ${t.speaker}` : ''}</Typography>
          ))}
          {ticked.length > 3 && <Typography variant="caption" color="text.secondary">+{ticked.length - 3} more</Typography>}
        </Stack>
        {teamsButtons}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {monthSelect}
      {meetingDateField}
      {teamsButtons}
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Topics</Typography>
        <TopicsEditor topics={data.topics} onChange={(topics) => save({ ...data, topics })} />
      </Box>
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Action items</Typography>
        <ActionItemsEditor items={data.actionItems} onChange={(actionItems) => save({ ...data, actionItems })} />
        <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={addTicketedToTasks}>
          Add ticked items to my to-do
        </Button>
      </Box>
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Recap</Typography>
        <TextField
          key={`recap-${month}`}
          size="small"
          fullWidth
          multiline
          minRows={3}
          label="Recap notes"
          defaultValue={data.recapText ?? ''}
          onBlur={(e) => { if (e.target.value !== (data.recapText ?? '')) save({ ...data, recapText: e.target.value }) }}
        />
        <TextField
          key={`grace-${month}`}
          size="small"
          fullWidth
          label="GRACE link"
          sx={{ mt: 1 }}
          defaultValue={data.graceUrl ?? ''}
          onBlur={(e) => { if (e.target.value !== (data.graceUrl ?? '')) save({ ...data, graceUrl: e.target.value }) }}
        />
        <Button size="small" variant="outlined" startIcon={<Copy size={16} />} sx={{ mt: 1 }} onClick={copyRecap}>
          Copy recap for GRACE
        </Button>
      </Box>
    </Box>
  )
}
