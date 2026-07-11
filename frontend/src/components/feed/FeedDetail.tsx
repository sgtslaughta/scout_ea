import { useQueryClient } from '@tanstack/react-query'
import { Box, Typography, Button, IconButton } from '@mui/material'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { setNewsStatus, setLearningStatus } from '@/api'
import { TagEditor } from '@/components/TagEditor'
import { useFriendlyTime } from '@/lib/timePrefs'
import { refTypeOf, type FeedSelection } from './types'

interface Props { selection: FeedSelection | null; onClose: () => void }

/** Slide-in detail: synopsis + SP1 TagEditor + status actions (news/learning only). */
export function FeedDetail({ selection, onClose }: Props) {
  const open = selection !== null
  const qc = useQueryClient()
  const friendly = useFriendlyTime()
  const category = selection?.category
  const item = (selection?.item as Record<string, unknown>) ?? {}
  const canStatus = category === 'news' || category === 'learning'

  const setStatus = (status: string) => {
    if (!selection) return
    const fn = category === 'news' ? setNewsStatus : setLearningStatus
    fn(selection.id, status).then(() => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: [category] })
      toast.success(`Marked ${status}`)
      onClose()
    }).catch(() => toast.error('Failed to update'))
  }

  const when = (item.when as string) ?? (item.event_at as string) ?? ''

  return (
    <Box
      aria-hidden={!open}
      sx={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 5,
        bgcolor: 'background.paper', borderLeft: '1px solid', borderColor: 'divider',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        boxShadow: open ? '-8px 0 24px rgba(0,0,0,0.25)' : 'none',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {selection && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.title as string}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: '"JetBrains Mono", monospace' }}>
                {category}{when ? ` · ${friendly(when)}` : ''}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="Close detail"><X size={16} /></IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
            {(item.synopsis as string) && <Typography variant="body2" sx={{ mb: 2 }}>{item.synopsis as string}</Typography>}
            <TagEditor refType={refTypeOf(category)} refId={selection.id} />
          </Box>
          {canStatus && (
            <Box sx={{ display: 'flex', gap: 1, p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button size="small" variant="outlined" onClick={() => setStatus('read')}>Mark read</Button>
              <Button size="small" variant="outlined" onClick={() => setStatus(category === 'news' ? 'archived' : 'dismissed')}>
                {category === 'news' ? 'Archive' : 'Dismiss'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
