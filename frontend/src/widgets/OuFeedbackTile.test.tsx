import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import OuFeedbackTile from './OuFeedbackTile'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, getRecords: vi.fn(), addRecord: vi.fn(async () => ({ id: 1 })), createTask: vi.fn(async () => ({ id: 9 })) }
})

const mockGetRecords = vi.mocked(api.getRecords)
const mockAddRecord = vi.mocked(api.addRecord)
const mockCreateTask = vi.mocked(api.createTask)

afterEach(() => vi.clearAllMocks())

const records: api.RecordItem[] = [
  {
    id: 1, kind: 'ou_feedback', external_ref: 'msg-1', status: 'active', sort: 0,
    created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
    data: { who: 'Jamie Lee', text: 'The renewal paperwork keeps getting stuck in legal review.', source: 'email', when: '2026-07-01', needsAction: true },
  },
  {
    id: 2, kind: 'ou_feedback', external_ref: 'msg-2', status: 'active', sort: 0,
    created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z',
    data: { who: 'Pat Ortiz', text: 'Loved the last QBR deck, no changes needed.', source: 'teams', when: '2026-07-02', needsAction: false },
  },
  // malformed: no text at all — must be skipped, not crash
  { id: 3, kind: 'ou_feedback', external_ref: 'bad', status: 'active', sort: 0, created_at: '2026-07-03T00:00:00Z', updated_at: '2026-07-03T00:00:00Z', data: { who: 'No text' } },
]

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('OuFeedbackTile', () => {
  it('shows only items needing action by default, skips malformed rows', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(<OuFeedbackTile />)

    expect(await screen.findByText('Jamie Lee')).toBeInTheDocument()
    expect(screen.queryByText('Pat Ortiz')).not.toBeInTheDocument()
    expect(screen.queryByText('No text')).not.toBeInTheDocument()
  })

  it('creates a task from feedback needing action', async () => {
    mockGetRecords.mockResolvedValue([records[0]])
    wrap(<OuFeedbackTile />)

    const button = await screen.findByRole('button', { name: /add to my to-do list/i })
    fireEvent.click(button)

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledTimes(1))
    expect(mockAddRecord).toHaveBeenCalledWith(
      'ou_feedback', 'msg-1', expect.objectContaining({ taskCreated: true }), 'active',
    )
    expect(toast.success).toHaveBeenCalled()
  })

  it('does not offer to add a task again once taskCreated is set', async () => {
    mockGetRecords.mockResolvedValueOnce([{ ...records[0], data: { ...records[0].data, taskCreated: true } }])
    wrap(<OuFeedbackTile />)

    await screen.findByText('Jamie Lee')
    expect(screen.queryByRole('button', { name: /add to my to-do list/i })).not.toBeInTheDocument()
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('offers a row task button that opens a modal prefilled from the row', async () => {
    mockGetRecords.mockResolvedValueOnce([records[0]])
    wrap(<OuFeedbackTile />)

    const button = await screen.findByRole('button', { name: /create a task from this/i })
    fireEvent.click(button)

    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue('Follow up: Jamie Lee')
  })

  it('shows the already-added variant once taskCreated is set, still enabled', async () => {
    mockGetRecords.mockResolvedValueOnce([{ ...records[0], data: { ...records[0].data, taskCreated: true } }])
    wrap(<OuFeedbackTile />)

    const button = await screen.findByRole('button', { name: /task already created — add another\?/i })
    expect(button).toBeEnabled()
  })
})
