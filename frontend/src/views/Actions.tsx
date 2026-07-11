import { Box, Typography, Button, Stack, Chip, Link } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listActions, approveAction, dismissAction, type Action } from '../api'

const safeHttpUrl = (u: unknown): string | null => {
  try {
    const p = new URL(String(u))
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.toString() : null
  } catch {
    return null
  }
}

const preview = (a: Action) =>
  a.rationale || (a.payload?.subject as string) || (a.payload?.message as string) || a.action_type

export function ActionsView() {
  const qc = useQueryClient()
  const { data: actions = [] } = useQuery({
    queryKey: ['actions'], queryFn: () => listActions(), refetchInterval: 10000,
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['actions'] })
  const go = useMutation({ mutationFn: approveAction,
    onSuccess: () => { toast.success('Approved'); invalidate() } })
  const drop = useMutation({ mutationFn: dismissAction,
    onSuccess: () => { toast('Dismissed'); invalidate() } })

  const pending = actions.filter((a) => a.status === 'drafted' && a.mode === 'review')
  const running = actions.filter((a) => a.status === 'executing')
  const recent = actions.filter((a) => a.status === 'completed' || a.status === 'failed').slice(0, 20)

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5">Actions</Typography>

      <section>
        <Typography variant="subtitle2" gutterBottom>Pending review ({pending.length})</Typography>
        <Stack spacing={1}>
          {pending.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1,
                 border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <Chip size="small" label={a.action_type} />
              <Typography sx={{ flex: 1 }}>{preview(a)}</Typography>
              <Button size="small" variant="contained" onClick={() => go.mutate(a.id)}>Go</Button>
              <Button size="small" onClick={() => drop.mutate(a.id)}>Dismiss</Button>
            </Box>
          ))}
          {pending.length === 0 && <Typography variant="caption" color="text.secondary">Nothing waiting.</Typography>}
        </Stack>
      </section>

      <section>
        <Typography variant="subtitle2" gutterBottom>Running ({running.length})</Typography>
        <Stack spacing={1}>
          {running.map((a) => (
            <Typography key={a.id} variant="body2">⏳ {a.action_type} — {preview(a)}</Typography>
          ))}
          {running.length === 0 && <Typography variant="caption" color="text.secondary">Nothing running.</Typography>}
        </Stack>
      </section>

      <section>
        <Typography variant="subtitle2" gutterBottom>Recent results</Typography>
        <Stack spacing={1}>
          {recent.map((a) => (
            <Typography key={a.id} variant="body2"
              color={a.status === 'failed' ? 'error' : 'text.primary'}>
              {a.status === 'failed' ? '✗' : '✓'} {a.action_type} — {preview(a)}{' '}
              {safeHttpUrl(a.result?.access_url) ? (
                <Link href={safeHttpUrl(a.result?.access_url)!} target="_blank" rel="noopener noreferrer">Open</Link>
              ) : null}
            </Typography>
          ))}
          {recent.length === 0 && <Typography variant="caption" color="text.secondary">No recent results.</Typography>}
        </Stack>
      </section>
    </Box>
  )
}
