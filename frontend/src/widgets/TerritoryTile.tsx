import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { FileText, Video, ClipboardList } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getRecords, type RecordItem } from '@/api'
import { safeHttpUrl } from '@/lib/url'
import { useFriendlyTime } from '@/lib/timePrefs'
import { PersonName } from '@/components/PersonName'
import { useWidgetCount, useWidgetExpanded } from './WidgetCard'
import { RecordTable } from './RecordTable'
import type { RecordColumn } from './RecordTable'

const MAX_ROWS = 5

export type AttachmentKind = 'recording' | 'deck' | 'recap'
const ATTACHMENT_KINDS: AttachmentKind[] = ['recording', 'deck', 'recap']
const ATTACHMENT_ICON: Record<AttachmentKind, LucideIcon> = { recording: Video, deck: FileText, recap: ClipboardList }

export interface TerritoryAttachment { kind: AttachmentKind; label: string; url: string }

export interface TerritoryRow {
  id: number
  externalRef: string
  manager?: string
  date?: string
  presenter?: string
  customerPlanUrl?: string
  attachments: TerritoryAttachment[]
}

/** Raw shape written by the territory_review skill — untrusted, fields may be missing. */
interface RawTerritoryData {
  manager?: unknown
  date?: unknown
  presenter?: unknown
  customerPlanUrl?: unknown
  attachments?: unknown
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

function isAttachment(v: unknown): v is TerritoryAttachment {
  if (!v || typeof v !== 'object') return false
  const a = v as Record<string, unknown>
  return typeof a.url === 'string' && a.url.length > 0
    && typeof a.label === 'string' && a.label.length > 0
    && ATTACHMENT_KINDS.includes(a.kind as AttachmentKind)
}

function isValidDate(v: unknown): v is string {
  return typeof v === 'string' && !isNaN(new Date(v).getTime())
}

/**
 * Validates+narrows one raw record into a TerritoryRow, or null if the blob is
 * malformed. A row must have a manager or a date — the two things the master
 * schedule is organized by — or it's unusable.
 */
export function parseTerritoryRecord(r: RecordItem): TerritoryRow | null {
  const d = r.data as RawTerritoryData
  const manager = str(d.manager)
  const date = isValidDate(d.date) ? d.date : undefined
  if (!manager && !date) return null
  return {
    id: r.id,
    externalRef: r.external_ref,
    manager,
    date,
    presenter: str(d.presenter),
    customerPlanUrl: str(d.customerPlanUrl),
    attachments: Array.isArray(d.attachments) ? d.attachments.filter(isAttachment) : [],
  }
}

const dash = (v: string | undefined) => v ?? '—'

function ArtefactLinks({ attachments }: { attachments: TerritoryAttachment[] }) {
  if (attachments.length === 0) {
    return <Typography variant="body2" color="text.secondary">No artefacts yet</Typography>
  }
  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
      {attachments.map((a, i) => {
        const url = safeHttpUrl(a.url)
        if (!url) return null
        const Icon = ATTACHMENT_ICON[a.kind]
        return (
          <Link key={`${a.kind}-${i}`} href={url} target="_blank" rel="noopener" underline="hover"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Icon size={14} aria-hidden="true" /> {a.label}
          </Link>
        )
      })}
    </Stack>
  )
}

const makeColumns = (friendly: (iso: string) => string): RecordColumn<TerritoryRow>[] => [
  { key: 'date', header: 'Date', compact: true, render: (r) => (r.date ? friendly(r.date) : '—') },
  {
    key: 'manager', header: 'Manager', compact: true,
    render: (r) => (r.manager ? <PersonName name={r.manager} /> : dash(r.manager)),
  },
  {
    key: 'presenter', header: 'Presenting', compact: true,
    render: (r) => (r.presenter ? <PersonName name={r.presenter} /> : dash(r.presenter)),
  },
  {
    key: 'customerPlan', header: 'Customer plan',
    render: (r) => {
      const url = safeHttpUrl(r.customerPlanUrl)
      return url
        ? <Link href={url} target="_blank" rel="noopener" underline="hover">Customer plan</Link>
        : <Typography variant="body2" color="text.secondary">—</Typography>
    },
  },
  { key: 'artefacts', header: 'Artefacts', render: (r) => <ArtefactLinks attachments={r.attachments} /> },
]

export default function TerritoryTile() {
  const { data = [] } = useQuery({ queryKey: ['records', 'territory'], queryFn: () => getRecords('territory'), refetchInterval: 15000 })
  const friendly = useFriendlyTime()
  const expanded = useWidgetExpanded()

  const sorted = useMemo(() => {
    const rows = data.map(parseTerritoryRecord).filter((r): r is TerritoryRow => r !== null)
    return rows.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
  }, [data])
  useWidgetCount(sorted.length)

  // The expand dialog shows the full schedule and every column; the grid
  // tile stays scannable with just date/manager/presenter and a short list.
  const rows = expanded ? sorted : sorted.slice(0, MAX_ROWS)
  const columns = useMemo(
    () => (expanded ? makeColumns(friendly).map((c) => ({ ...c, compact: true })) : makeColumns(friendly)),
    [friendly, expanded],
  )

  return (
    <Box sx={{ height: '100%' }}>
      <RecordTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        emptyMessage="No reviews on the schedule yet."
      />
    </Box>
  )
}
