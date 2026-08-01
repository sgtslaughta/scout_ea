import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import { MessageTile } from './MessageTile'

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

const now = new Date()
const today = (h: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h).toISOString()
const yesterday = new Date(now.getTime() - 86400000).toISOString()

const emailRecords: api.RecordItem[] = [
  {
    id: 1, kind: 'email', external_ref: 'msg-1', status: 'active', sort: 0,
    created_at: today(9), updated_at: today(9),
    data: {
      from: 'Ada Lovelace', fromEmail: 'ada@x.com', subject: 'Unread + mentioned', preview: 'Hi there',
      receivedAt: today(9), isUnread: true, isMention: true, webUrl: 'https://x.com/1', folder: 'Inbox',
    },
  },
  {
    id: 2, kind: 'email', external_ref: 'msg-2', status: 'active', sort: 0,
    created_at: today(10), updated_at: today(10),
    data: {
      from: 'Bob', fromEmail: 'bob@x.com', subject: 'From yesterday', preview: 'Old news',
      receivedAt: yesterday, isUnread: false, isMention: false, folder: 'Inbox',
    },
  },
  {
    id: 3, kind: 'email', external_ref: 'msg-3', status: 'active', sort: 0,
    created_at: today(11), updated_at: today(11),
    data: {
      from: 'Cora', subject: 'Newest', preview: 'Latest one',
      receivedAt: today(11), isUnread: true, isMention: false, folder: 'Inbox',
    },
  },
  { id: 4, kind: 'email', external_ref: 'msg-4', status: 'active', sort: 0, created_at: today(12), updated_at: today(12), data: { subject: 'Missing sender' } },
  {
    id: 5, kind: 'email', external_ref: 'msg-5', status: 'active', sort: 0,
    created_at: today(1), updated_at: today(1),
    data: { from: 'D', subject: '4th', preview: 'p', receivedAt: today(1), isUnread: false, isMention: false },
  },
  {
    id: 6, kind: 'email', external_ref: 'msg-6', status: 'active', sort: 0,
    created_at: today(2), updated_at: today(2),
    data: { from: 'E', subject: '5th', preview: 'p', receivedAt: today(2), isUnread: false, isMention: false },
  },
  {
    id: 7, kind: 'email', external_ref: 'msg-7', status: 'active', sort: 0,
    created_at: today(3), updated_at: today(3),
    data: { from: 'F', subject: '6th', preview: 'p', receivedAt: today(3), isUnread: false, isMention: false },
  },
]

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, getRecords: vi.fn(), createAction: vi.fn(async () => ({ id: 1 })) }
})

const mockGetRecords = vi.mocked(api.getRecords)
const mockCreateAction = vi.mocked(api.createAction)

afterEach(() => vi.clearAllMocks())

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('MessageTile', () => {
  it('computes counts, skips malformed rows, sorts newest-first, caps at 5', async () => {
    mockGetRecords.mockResolvedValueOnce(emailRecords)
    wrap(<MessageTile kind="email" />)

    expect(await screen.findByText('Newest')).toBeInTheDocument()
    // unread total: msg-1, msg-3 (isUnread true) = 2 (msg-4 skipped as malformed)
    expect(screen.getByText('2 unread')).toBeInTheDocument()
    // new today: msg-1, msg-3, msg-5, msg-6, msg-7 all received "today" = 5 (msg-2 is yesterday, msg-4 malformed)
    expect(screen.getByText('5 new today')).toBeInTheDocument()
    // mentions: msg-1 only
    expect(screen.getByText('1 @mentions')).toBeInTheDocument()

    // malformed row (missing sender) never rendered
    expect(screen.queryByText('Missing sender')).not.toBeInTheDocument()

    // cap at 5 rows: by receivedAt desc the 5 kept are msg-3,1,7,6,5 ('4th'); the
    // oldest valid one, msg-2 ('From yesterday'), is bumped off the list
    expect(screen.getByText('4th')).toBeInTheDocument()
    expect(screen.queryByText('From yesterday')).not.toBeInTheDocument()

    // newest-first ordering: 'Newest' (msg-3, today) should appear before '4th' (msg-5, oldest kept) in the DOM
    const newest = screen.getByText('Newest')
    const oldest = screen.getByText('4th')
    expect(newest.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows empty state chips (0) with no rows', async () => {
    mockGetRecords.mockResolvedValueOnce([])
    wrap(<MessageTile kind="email" />)
    expect(await screen.findByText('0 unread')).toBeInTheDocument()
  })

  it('queues an email_delete action with external_ref in the payload', async () => {
    mockGetRecords.mockResolvedValueOnce([emailRecords[0]])
    wrap(<MessageTile kind="email" />)
    await screen.findByText('Unread + mentioned')

    fireEvent.click(screen.getAllByRole('button', { name: /actions/i })[0])
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    fireEvent.click(await screen.findByRole('button', { name: /approve & send/i }))

    await waitFor(() => expect(mockCreateAction).toHaveBeenCalledWith(expect.objectContaining({
      action_type: 'email_delete',
      entity_type: 'email',
      entity_id: 1,
      payload: { external_ref: 'msg-1' },
    })))
    expect(toast.success).toHaveBeenCalled()
  })

  it('skips the action menu for a record with no external_ref', async () => {
    const noRef = { ...emailRecords[0], external_ref: '' }
    mockGetRecords.mockResolvedValueOnce([noRef])
    wrap(<MessageTile kind="email" />)
    await screen.findByText('Unread + mentioned')
    expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument()
  })
})
