import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { getRecords, type RecordItem } from '@/api'
import { useFriendlyTime } from '@/lib/timePrefs'
import { ActionMenu } from '@/components/actions/ActionMenu'
import { useWidgetCount } from './WidgetCard'

const MAX_ROWS = 5

/** Raw shape written by the email_preferred/chat_preferred skills — untrusted, fields may be missing. */
interface RawMessage {
  from?: unknown
  fromEmail?: unknown
  subject?: unknown
  topic?: unknown
  preview?: unknown
  receivedAt?: unknown
  isUnread?: unknown
  isMention?: unknown
  webUrl?: unknown
  folder?: unknown
}

export interface Message {
  id: number
  external_ref: string
  from: string
  subject: string
  preview?: string
  receivedAt: string
  isUnread: boolean
  isMention: boolean
  webUrl?: string
  folder?: string
}

/** Validates+narrows one raw record into a Message, or null if the blob is malformed. */
function parseMessage(kind: 'email' | 'chat', r: RecordItem): Message | null {
  const d = r.data as RawMessage
  const from = typeof d.from === 'string' && d.from ? d.from : null
  const subjectRaw = kind === 'email' ? d.subject : d.topic
  const subject = typeof subjectRaw === 'string' && subjectRaw ? subjectRaw : null
  const receivedAt = typeof d.receivedAt === 'string' && !isNaN(new Date(d.receivedAt).getTime())
    ? d.receivedAt
    : null
  if (!from || !subject || !receivedAt) return null
  return {
    id: r.id,
    external_ref: r.external_ref,
    from,
    subject,
    preview: typeof d.preview === 'string' ? d.preview : undefined,
    receivedAt,
    isUnread: d.isUnread === true,
    isMention: d.isMention === true,
    webUrl: typeof d.webUrl === 'string' ? d.webUrl : undefined,
    folder: typeof d.folder === 'string' ? d.folder : undefined,
  }
}

function isToday(iso: string, now: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export function computeCounts(messages: Message[], now = new Date()) {
  return {
    unread: messages.filter((m) => m.isUnread).length,
    newToday: messages.filter((m) => isToday(m.receivedAt, now)).length,
    mentions: messages.filter((m) => m.isMention).length,
  }
}

function MessageRow({ kind, message, friendly }: {
  kind: 'email' | 'chat'
  message: Message
  friendly: (iso: string) => string
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography variant="body1" sx={{ fontWeight: message.isUnread ? 700 : 500 }}>{message.from}</Typography>
          {message.isMention && <Chip size="small" color="warning" label="@mention" />}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {friendly(message.receivedAt)}
          </Typography>
        </Stack>
        <Typography variant="body2">{message.subject}</Typography>
        {message.preview && (
          <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {message.preview}
          </Typography>
        )}
      </Box>
      {message.external_ref && (
        <ActionMenu entity={{ type: kind, id: message.id }} extraPayload={{ external_ref: message.external_ref }} />
      )}
    </Box>
  )
}

export function MessageTile({ kind }: { kind: 'email' | 'chat' }) {
  const { data = [] } = useQuery({
    queryKey: ['records', kind],
    queryFn: () => getRecords(kind),
    refetchInterval: 15000,
  })
  const friendly = useFriendlyTime()

  const messages = useMemo(() => {
    const parsed = data
      .map((r) => parseMessage(kind, r))
      .filter((m): m is Message => m !== null)
    return parsed.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
  }, [data, kind])

  useWidgetCount(messages.length)

  const counts = computeCounts(messages)
  const rows = messages.slice(0, MAX_ROWS)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5 }}>
      <Stack direction="row" spacing={1}>
        <Chip
          label={`${counts.unread} unread`}
          sx={{ fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums' }}
        />
        <Chip
          label={`${counts.newToday} new today`}
          sx={{ fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums' }}
        />
        <Chip
          label={`${counts.mentions} @mentions`}
          sx={{ fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums' }}
        />
      </Stack>
      <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />} sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        {rows.map((m) => (
          <MessageRow key={m.id} kind={kind} message={m} friendly={friendly} />
        ))}
      </Stack>
    </Box>
  )
}
