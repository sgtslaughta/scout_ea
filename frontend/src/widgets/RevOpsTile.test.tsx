import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import RevOpsTile from './RevOpsTile'
import { WidgetCard } from './WidgetCard'
import { currentMonth, monthLabel, monthOptions } from './revops/months'

// Real "today", not faked — vi.useFakeTimers() deadlocks RTL's findBy/waitFor
// polling, so months are computed from the real clock instead.
const thisMonth = currentMonth()
const prevMonth = monthOptions(thisMonth, 1)[0]

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return {
    ...actual,
    getRecords: vi.fn(),
    addRecord: vi.fn(async () => ({ id: 1 })),
    createTask: vi.fn(async () => ({ id: 9 })),
    createAction: vi.fn(async () => ({ id: 5 })),
  }
})

const mockGetRecords = vi.mocked(api.getRecords)
const mockAddRecord = vi.mocked(api.addRecord)
const mockCreateTask = vi.mocked(api.createTask)
const mockCreateAction = vi.mocked(api.createAction)

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})
afterEach(() => vi.clearAllMocks())

function wrap(ui: React.ReactNode, expandDialog = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rendered = render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <WidgetCard title="RevOps" onRefresh={() => {}} onHide={() => {}}>
            {ui}
          </WidgetCard>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
  if (expandDialog) fireEvent.click(screen.getByRole('button', { name: /expand revops/i }))
  return rendered
}

function thisMonthRecord(overrides: Partial<api.RecordItem['data']> = {}): api.RecordItem {
  return {
    id: 1, kind: 'revops_meeting', external_ref: `revops:${thisMonth}`, status: 'active', sort: 0,
    created_at: `${thisMonth}-01T00:00:00Z`, updated_at: `${thisMonth}-01T00:00:00Z`,
    data: {
      month: thisMonth,
      meetingAt: `${thisMonth}-12T10:00:00Z`,
      meetingSource: 'calendar',
      topics: [
        { id: 't1', title: 'Pipeline review', speaker: 'Jamie Lee', speakerSource: 'MSX', onAgenda: true },
        { id: 't2', title: 'Renewals', onAgenda: false },
      ],
      actionItems: [
        { id: 'a1', text: 'Follow up with legal', owner: 'Pat', done: true, source: 'user', taskAdded: false },
      ],
      recapText: 'Great meeting',
      graceUrl: 'https://grace.example/notes/1',
      ...overrides,
    },
  }
}

function prevMonthRecord(): api.RecordItem {
  return {
    id: 2, kind: 'revops_meeting', external_ref: `revops:${prevMonth}`, status: 'active', sort: 0,
    created_at: `${prevMonth}-01T00:00:00Z`, updated_at: `${prevMonth}-01T00:00:00Z`,
    data: {
      month: prevMonth,
      meetingAt: null,
      meetingSource: 'manual',
      topics: [{ id: 'f1', title: 'Prior-month-only topic', onAgenda: true }],
      actionItems: [],
    },
  }
}

describe('RevOpsTile', () => {
  it('defaults to the current month and shows its ticked topics', async () => {
    mockGetRecords.mockResolvedValueOnce([thisMonthRecord()])
    wrap(<RevOpsTile />)
    expect(await screen.findByText(/pipeline review/i)).toBeInTheDocument()
    expect(screen.queryByText(/prior-month-only topic/i)).not.toBeInTheDocument()
  })

  it('switches months and loads the matching record', async () => {
    mockGetRecords.mockResolvedValue([thisMonthRecord(), prevMonthRecord()])
    wrap(<RevOpsTile />)
    await screen.findByText(/pipeline review/i)

    fireEvent.mouseDown(screen.getByLabelText('Month'))
    fireEvent.click(await screen.findByRole('option', { name: new RegExp(monthLabel(prevMonth), 'i') }))

    expect(await screen.findByText(/prior-month-only topic/i)).toBeInTheDocument()
    expect(screen.queryByText(/pipeline review/i)).not.toBeInTheDocument()
  })

  it('renders an empty editable state for a month with no record', async () => {
    mockGetRecords.mockResolvedValueOnce([])
    wrap(<RevOpsTile />, true)
    expect(await screen.findByText(/no topics yet/i)).toBeInTheDocument()
    expect(screen.getByLabelText('New topic title')).toBeInTheDocument()
  })

  it('adding a topic persists it alongside the existing action items (merge)', async () => {
    mockGetRecords.mockResolvedValueOnce([thisMonthRecord()])
    wrap(<RevOpsTile />, true)
    await screen.findByText(/pipeline review/i)

    fireEvent.change(screen.getByLabelText('New topic title'), { target: { value: 'New Q1 topic' } })
    fireEvent.click(screen.getByRole('button', { name: /add topic/i }))

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalled())
    const [, , savedData] = mockAddRecord.mock.calls[0]
    expect(savedData.topics).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'New Q1 topic' }), expect.objectContaining({ id: 't1' })]),
    )
    expect(savedData.actionItems).toEqual([expect.objectContaining({ id: 'a1', text: 'Follow up with legal' })])
  })

  it('ticking a topic changes what is on the agenda', async () => {
    mockGetRecords.mockResolvedValueOnce([thisMonthRecord()])
    wrap(<RevOpsTile />, true)
    await screen.findByText(/pipeline review/i)

    const checkbox = screen.getByLabelText('On agenda: Renewals')
    fireEvent.click(checkbox)

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalled())
    const [, , savedData] = mockAddRecord.mock.calls[0]
    expect(savedData.topics.find((t: { id: string }) => t.id === 't2')).toEqual(
      expect.objectContaining({ onAgenda: true }),
    )
  })

  it('sends the agenda as a queued teams_post with ticked topics and speakers', async () => {
    mockGetRecords.mockResolvedValueOnce([thisMonthRecord()])
    wrap(<RevOpsTile />)
    await screen.findByText(/pipeline review/i)

    fireEvent.click(screen.getByRole('button', { name: /send agenda to teams/i }))

    await waitFor(() => expect(mockCreateAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: 'teams_post',
        approve: false,
        payload: expect.objectContaining({
          topics: [{ title: 'Pipeline review', speaker: 'Jamie Lee' }],
        }),
      }),
    ))
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/queued/i))
  })

  it('says so instead of posting a recap link when no GRACE url is set', async () => {
    mockGetRecords.mockResolvedValueOnce([thisMonthRecord({ graceUrl: undefined })])
    wrap(<RevOpsTile />)
    await screen.findByText(/pipeline review/i)

    fireEvent.click(screen.getByRole('button', { name: /post recap link to teams/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(mockCreateAction).not.toHaveBeenCalled()
  })

  it('adds ticked action items to tasks', async () => {
    mockGetRecords.mockResolvedValueOnce([thisMonthRecord()])
    wrap(<RevOpsTile />, true)
    await screen.findByDisplayValue(/follow up with legal/i)

    fireEvent.click(screen.getByRole('button', { name: /add ticked items to my to-do/i }))
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledTimes(1))
    expect(mockAddRecord).toHaveBeenCalled()
    const [, , savedData] = mockAddRecord.mock.calls[0]
    expect(savedData.actionItems).toEqual([expect.objectContaining({ id: 'a1', taskAdded: true })])
  })

  it('does not add an action item to tasks again once already flagged', async () => {
    // As the server would report it after the first add — taskAdded already true.
    mockGetRecords.mockResolvedValueOnce([thisMonthRecord({
      actionItems: [{ id: 'a1', text: 'Follow up with legal', owner: 'Pat', done: true, source: 'user', taskAdded: true }],
    })])
    wrap(<RevOpsTile />, true)
    await screen.findByDisplayValue(/follow up with legal/i)

    fireEvent.click(screen.getByRole('button', { name: /add ticked items to my to-do/i }))
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('copies a recap containing the action items to the clipboard', async () => {
    mockGetRecords.mockResolvedValueOnce([thisMonthRecord()])
    wrap(<RevOpsTile />, true)
    await screen.findByText(/pipeline review/i)

    fireEvent.click(screen.getByRole('button', { name: /copy recap for grace/i }))

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(text).toContain('Follow up with legal')
    expect(text).toContain('Great meeting')
  })
})
