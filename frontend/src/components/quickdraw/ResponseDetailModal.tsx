import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, Link,
} from '@mui/material'
import { BellOff, Trash2, ExternalLink } from 'lucide-react'
import type { Signal, Alert } from '@/api'
import { ActionMenu } from '@/components/actions/ActionMenu'
import { formatFriendly, DEFAULT_TIME_PREFS } from '@/lib/datetime'
import { safeHttpUrl } from '@/lib/url'

const DASH = '—'

function reasoningText(s: Signal): string {
  if (s.reasoning) return s.reasoning
  if (s.source_skill) return `Flagged by ${s.source_skill}${s.why ? ` — ${s.why}` : ''}`
  return s.why || 'No reasoning recorded yet.'
}

function WCell({ label, value }: { label: string; value?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: value ? 'text.primary' : 'text.disabled' }}>
        {value || DASH}
      </Typography>
    </Box>
  )
}

export function ResponseDetailModal({ open, kind, item, onClose, onStatus }: {
  open: boolean
  kind: 'signal' | 'alert'
  item: Signal | Alert | null
  onClose: () => void
  onStatus: (value: 'read' | 'dismissed') => void
}) {
  if (!item) return null
  const isSignal = kind === 'signal'
  const s = item as Signal
  const a = item as Alert
  const url = safeHttpUrl(item.url)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 0 }}>{item.title}</span>
        {isSignal && s.source_skill && <Chip size="small" label={s.source_skill} />}
        <Chip size="small" variant="outlined" label={item.status} />
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {isSignal ? (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <WCell label="WHO" value={s.who} />
              <WCell label="WHAT" value={s.what} />
              <WCell label="WHEN" value={s.when_rel} />
              <WCell label="WHY" value={s.why} />
            </Box>
            {s.summary && <Typography variant="body2">{s.summary}</Typography>}
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography variant="overline" color="text.secondary">AI Reasoning</Typography>
              <Typography variant="body2">{reasoningText(s)}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {s.type} · {s.source} · priority {s.priority} · {formatFriendly(s.created_at, DEFAULT_TIME_PREFS)}
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body2">{a.body || 'No detail.'}</Typography>
            <Typography variant="caption" color="text.secondary">
              severity {a.severity} · {formatFriendly(a.created_at, DEFAULT_TIME_PREFS)}
            </Typography>
          </>
        )}
        {url && (
          <Link href={url} target="_blank" rel="noopener noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <ExternalLink size={14} /> Open source
          </Link>
        )}
      </DialogContent>
      <DialogActions sx={{ gap: 0.5 }}>
        {isSignal && <ActionMenu entity={{ type: 'signal', id: item.id }} />}
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<BellOff size={14} />} onClick={() => onStatus('read')}>Silence</Button>
        <Button color="error" startIcon={<Trash2 size={14} />} onClick={() => onStatus('dismissed')}>Dismiss</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
