import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { ExternalLink, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { addRecord, getConfig, getRecords, type RecordItem } from '@/api'
import { safeHttpUrl } from '@/lib/url'
import { PersonName } from '@/components/PersonName'
import { useWidgetCount } from './WidgetCard'
import { RecordTable } from './RecordTable'
import type { RecordColumn } from './RecordTable'

const compactMoney = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
})
const fullMoney = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})

/** Raw shape written by the pipeline_tracker skill — untrusted, fields may be missing. */
interface RawPipelineData {
  customer?: unknown
  accountExec?: unknown
  tpid?: unknown
  opportunityId?: unknown
  totalValue?: unknown
  workload?: unknown
  salesTagId?: unknown
  status?: unknown
}

export interface PipelineRow {
  id: number
  externalRef: string
  customer?: string
  accountExec?: string
  tpid?: string
  opportunityId?: string
  totalValue?: number
  workload?: string
  salesTagId?: string
  dealStatus?: string
  /** record-level lookup state: 'pending' until the skill enriches it, then 'active' */
  recordStatus: string
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

/**
 * Validates+narrows one raw record into a PipelineRow, or null if the blob
 * is malformed. The one thing the user always supplies is a TPID or an
 * opportunity ID — a row missing both is unusable, so it's skipped.
 */
export function parsePipelineRecord(r: RecordItem): PipelineRow | null {
  const d = r.data as RawPipelineData
  const tpid = str(d.tpid)
  const opportunityId = str(d.opportunityId)
  if (!tpid && !opportunityId) return null
  const totalValue = typeof d.totalValue === 'number' && Number.isFinite(d.totalValue) ? d.totalValue : undefined
  return {
    id: r.id,
    externalRef: r.external_ref,
    customer: str(d.customer),
    accountExec: str(d.accountExec),
    tpid,
    opportunityId,
    totalValue,
    workload: str(d.workload),
    salesTagId: str(d.salesTagId),
    dealStatus: str(d.status),
    recordStatus: r.status,
  }
}

const dash = (v: string | undefined) => v ?? '—'

const columns: RecordColumn<PipelineRow>[] = [
  { key: 'customer', header: 'Customer', compact: true, render: (r) => dash(r.customer) },
  { key: 'workload', header: 'Workload', compact: true, render: (r) => dash(r.workload) },
  {
    key: 'totalValue', header: 'Value', compact: true, align: 'right',
    render: (r, { dense }) => (
      <Typography component="span" sx={{ fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums' }}>
        {r.totalValue == null ? '—' : (dense ? compactMoney : fullMoney).format(r.totalValue)}
      </Typography>
    ),
  },
  { key: 'status', header: 'Status', compact: true, render: (r) => dash(r.dealStatus ?? (r.recordStatus === 'pending' ? 'pending lookup' : undefined)) },
  {
    key: 'accountExec', header: 'Account exec',
    render: (r) => (r.accountExec ? <PersonName name={r.accountExec} /> : dash(r.accountExec)),
  },
  { key: 'tpid', header: 'TPID', render: (r) => dash(r.tpid) },
  { key: 'opportunityId', header: 'Opportunity ID', render: (r) => dash(r.opportunityId) },
  { key: 'salesTagId', header: 'Sales tag ID', render: (r) => dash(r.salesTagId) },
]

export default function PipelineTile() {
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['records', 'pipeline'], queryFn: () => getRecords('pipeline'), refetchInterval: 15000 })
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig })

  const rows = useMemo(
    () => data.map(parsePipelineRecord).filter((r): r is PipelineRow => r !== null),
    [data],
  )
  useWidgetCount(rows.length)

  const [tpidInput, setTpidInput] = useState('')
  const [oppIdInput, setOppIdInput] = useState('')
  const [tagInput, setTagInput] = useState('')

  const addMutation = useMutation({
    mutationFn: (vars: { ref: string; data: Record<string, unknown> }) =>
      addRecord('pipeline', vars.ref, vars.data, 'pending'),
    onSuccess: () => {
      toast.success('Tracking added — Scout will fill in the rest from MSX.')
      qc.invalidateQueries({ queryKey: ['records', 'pipeline'] })
      setTpidInput(''); setOppIdInput(''); setTagInput('')
    },
    onError: () => toast.error('Failed to add opportunity'),
  })

  const handleTrack = () => {
    const tpid = tpidInput.trim()
    const opportunityId = oppIdInput.trim()
    const salesTagId = tagInput.trim()
    if (!tpid && !opportunityId) return
    addMutation.mutate({
      ref: tpid || opportunityId,
      data: {
        ...(tpid ? { tpid } : {}),
        ...(opportunityId ? { opportunityId } : {}),
        ...(salesTagId ? { salesTagId } : {}),
      },
    })
  }

  const msxUrl = safeHttpUrl(config?.msx_dashboard_url)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5 }}>
      {msxUrl && (
        <Link href={msxUrl} target="_blank" rel="noopener" underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, alignSelf: 'flex-start' }}>
          <ExternalLink size={14} aria-hidden="true" /> Open MSX dashboard
        </Link>
      )}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <TextField size="small" label="TPID" value={tpidInput} onChange={(e) => setTpidInput(e.target.value)} sx={{ minWidth: 100 }} />
        <TextField size="small" label="Opportunity ID" value={oppIdInput} onChange={(e) => setOppIdInput(e.target.value)} sx={{ minWidth: 140 }} />
        <TextField size="small" label="Sales tag ID (optional)" value={tagInput} onChange={(e) => setTagInput(e.target.value)} sx={{ minWidth: 160 }} />
        <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={handleTrack} disabled={!tpidInput.trim() && !oppIdInput.trim()}>
          Track
        </Button>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <RecordTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          emptyMessage="No opportunities tracked yet."
        />
      </Box>
    </Box>
  )
}
