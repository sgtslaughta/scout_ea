import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { toast } from 'sonner'
import { addRecord, createTask, getRecords, type RecordItem } from '@/api'
import { PersonName } from '@/components/PersonName'
import { useWidgetCount, useWidgetExpanded } from './WidgetCard'
import { RecordTable } from './RecordTable'
import type { RecordColumn } from './RecordTable'

/** Raw shape written by the ou_feedback skill — untrusted, fields may be missing. */
interface RawOuFeedbackData {
  who?: unknown
  text?: unknown
  source?: unknown
  when?: unknown
  needsAction?: unknown
  taskCreated?: unknown
}

export interface OuFeedbackRow {
  id: number
  externalRef: string
  who?: string
  text: string
  source?: string
  when?: string
  needsAction: boolean
  taskCreated: boolean
  recordStatus: string
  /** original data blob, carried forward when flipping taskCreated */
  data: Record<string, unknown>
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

/**
 * Validates+narrows one raw record into an OuFeedbackRow, or null if the blob
 * is malformed. The one thing every catalogue entry needs is the feedback
 * text itself — a row missing it is unusable, so it's skipped.
 */
export function parseOuFeedbackRecord(r: RecordItem): OuFeedbackRow | null {
  const d = r.data as RawOuFeedbackData
  const text = str(d.text)
  if (!text) return null
  return {
    id: r.id,
    externalRef: r.external_ref,
    who: str(d.who),
    text,
    source: str(d.source),
    when: str(d.when),
    needsAction: d.needsAction === true,
    taskCreated: d.taskCreated === true,
    recordStatus: r.status,
    data: r.data,
  }
}

const dash = (v: string | undefined) => v ?? '—'
const excerpt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

export default function OuFeedbackTile() {
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['records', 'ou_feedback'], queryFn: () => getRecords('ou_feedback'), refetchInterval: 15000 })

  const rows = useMemo(
    () => data.map(parseOuFeedbackRecord).filter((r): r is OuFeedbackRow => r !== null),
    [data],
  )
  // The full catalogue size, not just the actionable subset — this drives the
  // "no feedback captured yet" empty state, distinct from "nothing needs action".
  useWidgetCount(rows.length)
  const expanded = useWidgetExpanded()
  // Catalogue, not a feed: the tile only surfaces items still needing action;
  // the expand dialog is where the user browses everything.
  const visibleRows = expanded ? rows : rows.filter((r) => r.needsAction)

  const addTaskMutation = useMutation({
    mutationFn: async (row: OuFeedbackRow) => {
      await createTask({
        title: `Follow up: ${excerpt(row.text, 80)}`,
        detail: row.who ? `OU feedback from ${row.who}` : 'OU feedback',
      })
      // Same external_ref upserts onto the existing row — flips taskCreated
      // without creating a duplicate catalogue entry.
      await addRecord('ou_feedback', row.externalRef, { ...row.data, taskCreated: true }, row.recordStatus)
    },
    onSuccess: () => {
      toast.success('Added to your to-do list')
      qc.invalidateQueries({ queryKey: ['records', 'ou_feedback'] })
    },
    onError: () => toast.error('Failed to add task'),
  })

  const columns: RecordColumn<OuFeedbackRow>[] = [
    {
      key: 'who', header: 'Who', compact: true,
      render: (r) => (r.who ? <PersonName name={r.who} /> : dash(r.who)),
    },
    {
      key: 'text', header: 'Feedback', compact: true,
      render: (r, { dense }) => <Typography component="span">{dense ? excerpt(r.text, 60) : r.text}</Typography>,
    },
    {
      // Combines the "needs action?" indicator with the affordance to act on
      // it, so the add-to-do-list action is reachable in the compact tile
      // view too, not stranded in a non-compact column that only appears
      // once the container is wide enough (the tile grid cell never is).
      key: 'needsAction', header: 'Action?', compact: true,
      render: (r) => {
        if (!r.needsAction) return <Chip size="small" label="No action" variant="outlined" />
        if (r.taskCreated) return <Chip size="small" label="Added" color="success" />
        return (
          <Button
            size="small"
            variant="outlined"
            disabled={addTaskMutation.isPending}
            onClick={() => addTaskMutation.mutate(r)}
          >
            Add to my to-do list
          </Button>
        )
      },
    },
    { key: 'source', header: 'Source', render: (r) => dash(r.source) },
    { key: 'when', header: 'When', render: (r) => dash(r.when) },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <RecordTable
        rows={visibleRows}
        columns={columns}
        getRowId={(r) => r.id}
        emptyMessage="Nothing needs action right now — expand to browse the full catalogue."
        rowTask={(r) => ({
          title: `Follow up: ${dash(r.who ?? r.source)}`,
          detail: r.text,
          personName: r.who,
          source: `OU Feedback — ${r.who ?? 'unknown'}, ${dash(r.when)}`,
          alreadyAdded: r.taskCreated,
        })}
      />
    </Box>
  )
}
