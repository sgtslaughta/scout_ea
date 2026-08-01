import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import type { SelectChangeEvent } from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import { toast } from 'sonner'
import { addRecord, getRecords, type RecordItem } from '@/api'
import { PersonName } from '@/components/PersonName'
import { useWidgetCount, useWidgetExpanded } from './WidgetCard'
import { RecordTable } from './RecordTable'
import type { RecordColumn } from './RecordTable'

// The "My action" choices — the user asked for "a drop down list or something
// to choose from" but hasn't confirmed the real options. This is a small,
// obviously-useful placeholder set; swap it out here once the user decides.
export const EBC_ACTIONS = ['Not started', 'Planning', 'Confirmed', 'Follow up needed', 'Done'] as const

const COMPACT_CAP = 5

/** Raw shape written by the ebc_innovation_hub skill — MSXI's fields are unknown, untrusted. */
interface RawEbcData {
  date?: unknown
  customer?: unknown
  accountExec?: unknown
  leadPlanner?: unknown
  myAction?: unknown
}

export interface EbcRow {
  record: RecordItem
  date?: string
  customer?: string
  accountExec?: string
  leadPlanner?: string
  myAction?: string
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

/**
 * Validates+narrows one raw record into an EbcRow, or null if it's unusable.
 * MSXI's field names are unknown, so almost everything is optional — the one
 * thing a row needs to be worth showing is a date or a customer name.
 */
export function parseEbcRecord(r: RecordItem): EbcRow | null {
  if (!r.data || typeof r.data !== 'object' || Array.isArray(r.data)) return null
  const d = r.data as RawEbcData
  const date = str(d.date)
  const customer = str(d.customer)
  if (!date && !customer) return null
  return {
    record: r,
    date,
    customer,
    accountExec: str(d.accountExec),
    leadPlanner: str(d.leadPlanner),
    myAction: str(d.myAction),
  }
}

const dash = (v: string | undefined) => v ?? '—'

export default function EbcTile() {
  const qc = useQueryClient()
  const expanded = useWidgetExpanded()
  const { data = [] } = useQuery({ queryKey: ['records', 'ebc'], queryFn: () => getRecords('ebc'), refetchInterval: 15000 })

  const rows = useMemo(() => {
    const parsed = data.map(parseEbcRecord).filter((r): r is EbcRow => r !== null)
    // rows without a date sort to the end rather than dropping out
    return parsed.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
  }, [data])
  useWidgetCount(rows.length)

  const visibleRows = expanded ? rows : rows.slice(0, COMPACT_CAP)

  // Two fields — leadPlanner and myAction — are hand-entered by the user;
  // everything else comes from MSXI. upsert_record overwrites the whole data
  // blob, so every edit must spread the existing record.data first and only
  // overlay the field being changed, never replace it with a fresh object.
  const updateMutation = useMutation({
    mutationFn: (vars: { row: EbcRow; patch: Record<string, unknown> }) =>
      addRecord(
        'ebc',
        vars.row.record.external_ref,
        { ...vars.row.record.data, ...vars.patch },
        vars.row.record.status,
        vars.row.record.sort,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', 'ebc'] }),
    onError: () => toast.error('Failed to update EBC session'),
  })

  const columns: RecordColumn<EbcRow>[] = useMemo(() => [
    { key: 'date', header: 'Date', compact: true, render: (r) => dash(r.date) },
    { key: 'customer', header: 'Customer', compact: true, render: (r) => dash(r.customer) },
    {
      key: 'myAction', header: 'My action', compact: true,
      render: (r) => (
        <Select
          size="small"
          variant="standard"
          displayEmpty
          value={r.myAction ?? ''}
          aria-label={`My action for ${r.customer ?? r.record.external_ref}`}
          onChange={(e: SelectChangeEvent) =>
            updateMutation.mutate({ row: r, patch: { myAction: e.target.value } })}
        >
          <MenuItem value=""><em>—</em></MenuItem>
          {EBC_ACTIONS.map((action) => (
            <MenuItem key={action} value={action}>{action}</MenuItem>
          ))}
        </Select>
      ),
    },
    {
      key: 'accountExec', header: 'Account exec',
      render: (r) => (r.accountExec ? <PersonName name={r.accountExec} /> : dash(r.accountExec)),
    },
    {
      key: 'leadPlanner', header: 'Lead planner',
      render: (r) => (
        <TextField
          size="small"
          variant="standard"
          defaultValue={r.leadPlanner ?? ''}
          aria-label={`Lead planner for ${r.customer ?? r.record.external_ref}`}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value !== (r.leadPlanner ?? '')) {
              updateMutation.mutate({ row: r, patch: { leadPlanner: value } })
            }
          }}
        />
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [updateMutation])

  return (
    <Box sx={{ height: '100%' }}>
      <RecordTable
        rows={visibleRows}
        columns={columns}
        getRowId={(r) => r.record.id}
        emptyMessage="No sessions booked yet."
        rowTask={(r) => ({
          title: `EBC follow-up: ${dash(r.customer)}`,
          dueAt: r.date,
          source: `EBC — ${dash(r.customer)}, ${dash(r.date)}`,
        })}
      />
    </Box>
  )
}
