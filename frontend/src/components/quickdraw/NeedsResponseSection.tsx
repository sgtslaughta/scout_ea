import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Stack } from '@mui/material'
import { Mail, Megaphone, BellOff, Trash2 } from 'lucide-react'
import { getSignals, getAlerts, setSignalStatus, type Signal, type Alert } from '@/api'
import { buildNeedsResponse, type ResponseItem } from './quickdrawData'
import { QuickdrawSection } from './QuickdrawSection'
import { QuickdrawItem, type QuickdrawAction } from './QuickdrawItem'
import { ResponseDetailModal } from './ResponseDetailModal'

type Detail = { kind: 'signal'; item: Signal } | { kind: 'alert'; item: Alert }

export function NeedsResponseSection({ expanded, collapsed, onToggle }: { expanded: boolean; collapsed: boolean; onToggle: (id: string) => void }) {
  const qc = useQueryClient()
  const [detail, setDetail] = useState<Detail | null>(null)
  const signalsQ = useQuery({ queryKey: ['signals', 'new'], queryFn: () => getSignals('new'), refetchInterval: 15000 })
  const alertsQ = useQuery({ queryKey: ['alerts'], queryFn: getAlerts, refetchInterval: 15000 })

  const status = useMutation({
    mutationFn: ({ table, id, value }: { table: string; id: number; value: string }) => setSignalStatus(table, id, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signals'] }); qc.invalidateQueries({ queryKey: ['alerts'] }) },
  })

  const unreadAlerts = (alertsQ.data ?? []).filter((a) => a.status === 'unread')
  const rows = buildNeedsResponse(signalsQ.data ?? [], unreadAlerts)
  const tableOf = (r: { kind: 'signal' | 'alert' }) => r.kind === 'signal' ? 'signals' : 'alerts'

  const openDetail = (r: ResponseItem) => {
    if (r.kind === 'signal') {
      const s = (signalsQ.data ?? []).find((x) => x.id === r.id)
      if (s) setDetail({ kind: 'signal', item: s })
    } else {
      const a = unreadAlerts.find((x) => x.id === r.id)
      if (a) setDetail({ kind: 'alert', item: a })
    }
  }

  const actionsFor = (r: ResponseItem): QuickdrawAction[] => [
    { label: 'Silence', icon: <BellOff size={14} />, onClick: () => status.mutate({ table: tableOf(r), id: r.id, value: 'read' }) },
    { label: 'Dismiss', icon: <Trash2 size={14} />, destructive: true, onClick: () => status.mutate({ table: tableOf(r), id: r.id, value: 'dismissed' }) },
  ]

  return (
    <QuickdrawSection
      id="needs" label="Needs Response" count={rows.length} collapsed={collapsed} onToggle={onToggle}
      loading={signalsQ.isLoading || alertsQ.isLoading} error={!!signalsQ.error || !!alertsQ.error}
      empty="Holstered — nothing to draw."
    >
      <Stack spacing={0.25} sx={{ px: 0.5 }}>
        {rows.map((r) => (
          <QuickdrawItem
            key={r.key}
            glyph={r.kind === 'signal' ? <Mail size={14} /> : <Megaphone size={14} />}
            title={r.title} detail={r.detail} expanded={expanded} actions={actionsFor(r)}
            onOpen={() => openDetail(r)}
          />
        ))}
      </Stack>
      <ResponseDetailModal
        open={!!detail}
        kind={detail?.kind ?? 'signal'}
        item={detail?.item ?? null}
        onClose={() => setDetail(null)}
        onStatus={(value) => {
          if (detail) { status.mutate({ table: tableOf(detail), id: detail.item.id, value }); setDetail(null) }
        }}
      />
    </QuickdrawSection>
  )
}
