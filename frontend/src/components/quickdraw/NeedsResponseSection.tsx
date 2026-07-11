import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Stack } from '@mui/material'
import { Mail, Megaphone, Reply, BellOff, Trash2 } from 'lucide-react'
import { getSignals, getAlerts, setSignalStatus } from '@/api'
import { buildNeedsResponse, type ResponseItem } from './quickdrawData'
import { QuickdrawSection } from './QuickdrawSection'
import { QuickdrawItem, type QuickdrawAction } from './QuickdrawItem'
import { ActionComposeModal } from './ActionComposeModal'

export function NeedsResponseSection({ expanded, collapsed, onToggle }: { expanded: boolean; collapsed: boolean; onToggle: (id: string) => void }) {
  const qc = useQueryClient()
  const [reply, setReply] = useState<ResponseItem | null>(null)
  const signalsQ = useQuery({ queryKey: ['signals', 'new'], queryFn: () => getSignals('new'), refetchInterval: 15000 })
  const alertsQ = useQuery({ queryKey: ['alerts'], queryFn: getAlerts, refetchInterval: 15000 })

  const status = useMutation({
    mutationFn: ({ table, id, value }: { table: string; id: number; value: string }) => setSignalStatus(table, id, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signals'] }); qc.invalidateQueries({ queryKey: ['alerts'] }) },
  })

  const unreadAlerts = (alertsQ.data ?? []).filter((a) => a.status === 'unread')
  const rows = buildNeedsResponse(signalsQ.data ?? [], unreadAlerts)
  const tableOf = (r: ResponseItem) => r.kind === 'signal' ? 'signals' : 'alerts'

  const actionsFor = (r: ResponseItem): QuickdrawAction[] => [
    { label: 'Reply', icon: <Reply size={14} />, onClick: () => setReply(r) },
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
            onOpen={r.url ? () => window.open(r.url, '_blank', 'noopener') : undefined}
          />
        ))}
      </Stack>
      <ActionComposeModal open={!!reply} title={reply ? `Reply to: ${reply.title}` : ''} onClose={() => setReply(null)} />
    </QuickdrawSection>
  )
}
