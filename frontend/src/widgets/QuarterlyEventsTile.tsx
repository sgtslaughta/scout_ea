import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { addRecord, getRecords, type RecordItem } from '@/api'
import { safeHttpUrl } from '@/lib/url'
import { useWidgetCount, useWidgetExpanded } from './WidgetCard'
import { RecordTable } from './RecordTable'
import type { RecordColumn } from './RecordTable'

const MAX_ROWS = 5

const compactMoney = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
})
const fullMoney = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})

/** Raw shape of a manually-entered quarterly event — untrusted, fields may be missing or hand-edited. */
interface RawQtrEventData {
  eventName?: unknown
  date?: unknown
  partners?: unknown
  budget?: unknown
  tpid?: unknown
  totalOpportunity?: unknown
  attachmentUrl?: unknown
}

export interface QtrEventRow {
  id: number
  externalRef: string
  eventName: string
  date: string
  partners?: string
  budget?: number
  tpid?: string
  totalOpportunity?: number
  attachmentUrl?: string
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/**
 * Validates+narrows one raw record into a QtrEventRow, or null if the blob
 * is malformed. Event name and date are the only fields the user is forced
 * to supply — a row missing either is unusable, so it's skipped.
 */
export function parseQtrEventRecord(r: RecordItem): QtrEventRow | null {
  const d = r.data as RawQtrEventData
  const eventName = str(d.eventName)
  const date = str(d.date)
  if (!eventName || !date) return null
  return {
    id: r.id,
    externalRef: r.external_ref,
    eventName,
    date,
    partners: str(d.partners),
    budget: num(d.budget),
    tpid: str(d.tpid),
    totalOpportunity: num(d.totalOpportunity),
    attachmentUrl: str(d.attachmentUrl),
  }
}

/** Soonest event first. */
export function sortByDate(rows: QtrEventRow[]): QtrEventRow[] {
  return [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

const dash = (v: string | undefined) => v ?? '—'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function AttachmentLink({ url }: { url?: string }) {
  const safe = safeHttpUrl(url)
  if (!safe) return <>—</>
  return (
    <Link component="button" type="button" underline="hover" onClick={() => window.open(safe, '_blank', 'noopener')}>
      View file
    </Link>
  )
}

const columns: RecordColumn<QtrEventRow>[] = [
  { key: 'eventName', header: 'Event', compact: true, render: (r) => r.eventName },
  { key: 'date', header: 'Date', compact: true, render: (r) => formatDate(r.date) },
  {
    key: 'totalOpportunity', header: 'Total opportunity', compact: true, align: 'right',
    render: (r, { dense }) => (
      <Typography component="span" sx={{ fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums' }}>
        {r.totalOpportunity == null ? '—' : (dense ? compactMoney : fullMoney).format(r.totalOpportunity)}
      </Typography>
    ),
  },
  { key: 'partners', header: 'Partners', render: (r) => dash(r.partners) },
  {
    key: 'budget', header: 'Budget', align: 'right',
    render: (r) => (
      <Typography component="span" sx={{ fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums' }}>
        {r.budget == null ? '—' : fullMoney.format(r.budget)}
      </Typography>
    ),
  },
  { key: 'tpid', header: 'TPID', render: (r) => dash(r.tpid) },
  { key: 'attachment', header: 'Approved customers', render: (r) => <AttachmentLink url={r.attachmentUrl} /> },
]

export default function QuarterlyEventsTile() {
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['records', 'qtr_event'], queryFn: () => getRecords('qtr_event'), refetchInterval: 15000 })

  const rows = useMemo(
    () => sortByDate(data.map(parseQtrEventRecord).filter((r): r is QtrEventRow => r !== null)),
    [data],
  )
  useWidgetCount(rows.length)
  const expanded = useWidgetExpanded()
  const visibleRows = expanded ? rows : rows.slice(0, MAX_ROWS)

  const [eventName, setEventName] = useState('')
  const [date, setDate] = useState('')
  const [partners, setPartners] = useState('')
  const [budget, setBudget] = useState('')
  const [tpid, setTpid] = useState('')
  const [totalOpportunity, setTotalOpportunity] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const resetForm = () => {
    setEventName(''); setDate(''); setPartners(''); setBudget('')
    setTpid(''); setTotalOpportunity(''); setAttachmentUrl(''); setFormError(null)
  }

  const addMutation = useMutation({
    mutationFn: (vars: { ref: string; data: Record<string, unknown> }) =>
      addRecord('qtr_event', vars.ref, vars.data),
    onSuccess: () => {
      toast.success('Event added to your list.')
      qc.invalidateQueries({ queryKey: ['records', 'qtr_event'] })
      resetForm()
    },
    onError: () => toast.error('Failed to add event'),
  })

  const handleAdd = () => {
    const trimmedName = eventName.trim()
    if (!trimmedName) {
      setFormError('Event name is required.')
      return
    }
    if (!date) {
      setFormError('Date is required.')
      return
    }
    const trimmedAttachment = attachmentUrl.trim()
    if (trimmedAttachment && !safeHttpUrl(trimmedAttachment)) {
      setFormError('Attachment link must be a valid http(s) URL.')
      return
    }
    setFormError(null)
    const budgetNum = budget.trim() ? Number(budget) : undefined
    const totalOppNum = totalOpportunity.trim() ? Number(totalOpportunity) : undefined
    addMutation.mutate({
      ref: `manual:${Date.now()}`,
      data: {
        eventName: trimmedName,
        date,
        ...(partners.trim() ? { partners: partners.trim() } : {}),
        ...(budgetNum !== undefined && Number.isFinite(budgetNum) ? { budget: budgetNum } : {}),
        ...(tpid.trim() ? { tpid: tpid.trim() } : {}),
        ...(totalOppNum !== undefined && Number.isFinite(totalOppNum) ? { totalOpportunity: totalOppNum } : {}),
        ...(trimmedAttachment ? { attachmentUrl: trimmedAttachment } : {}),
      },
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <TextField size="small" label="Event name" value={eventName} onChange={(e) => setEventName(e.target.value)} sx={{ minWidth: 160 }} />
          <TextField size="small" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
          <TextField size="small" label="Partner names" value={partners} onChange={(e) => setPartners(e.target.value)} sx={{ minWidth: 160 }} />
          <TextField size="small" label="TPID" value={tpid} onChange={(e) => setTpid(e.target.value)} sx={{ minWidth: 100 }} />
          <TextField size="small" label="Budget allocation" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} sx={{ minWidth: 140 }} />
          <TextField size="small" label="Total opportunity $" type="number" value={totalOpportunity} onChange={(e) => setTotalOpportunity(e.target.value)} sx={{ minWidth: 160 }} />
          <TextField size="small" label="Attachment link (Excel of approved customers)" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} sx={{ minWidth: 260 }} />
          <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={handleAdd}>
            Add event
          </Button>
        </Stack>
        {formError && <Typography variant="body2" color="error">{formError}</Typography>}
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <RecordTable
          rows={visibleRows}
          columns={columns}
          getRowId={(r) => r.id}
          emptyMessage="No events on the list yet. Add your first CXO engagement."
        />
      </Box>
    </Box>
  )
}
