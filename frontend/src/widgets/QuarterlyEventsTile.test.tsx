import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import QuarterlyEventsTile from './QuarterlyEventsTile'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, getRecords: vi.fn(), addRecord: vi.fn(async () => ({ id: 1 })) }
})

const mockGetRecords = vi.mocked(api.getRecords)
const mockAddRecord = vi.mocked(api.addRecord)

afterEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 0 })
})

const records: api.RecordItem[] = [
  {
    id: 1, kind: 'qtr_event', external_ref: 'manual:1', status: 'active', sort: 0,
    created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
    data: {
      eventName: 'Later Summit', date: '2026-12-01', partners: 'Fabrikam',
      budget: 50000, tpid: 'T-1', totalOpportunity: 1250000,
      attachmentUrl: 'https://sharepoint.example.com/list.xlsx',
    },
  },
  {
    id: 2, kind: 'qtr_event', external_ref: 'manual:2', status: 'active', sort: 0,
    created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z',
    data: { eventName: 'Sooner Roundtable', date: '2026-08-15', totalOpportunity: 300000 },
  },
  // malformed: missing both eventName and date — must be skipped, not crash
  { id: 3, kind: 'qtr_event', external_ref: 'bad', status: 'active', sort: 0, created_at: '2026-07-03T00:00:00Z', updated_at: '2026-07-03T00:00:00Z', data: { partners: 'No name or date' } },
]

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('QuarterlyEventsTile', () => {
  it('renders events soonest-first and skips malformed rows', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(<QuarterlyEventsTile />)

    await screen.findByText('Sooner Roundtable')
    expect(screen.getByText('Later Summit')).toBeInTheDocument()
    expect(screen.queryByText('No name or date')).not.toBeInTheDocument()

    const eventCells = screen.getAllByText(/Roundtable|Summit/)
    expect(eventCells[0]).toHaveTextContent('Sooner Roundtable')
    expect(eventCells[1]).toHaveTextContent('Later Summit')
  })

  it('shows only compact columns when narrow, all columns when wide', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    const narrow = wrap(<QuarterlyEventsTile />)
    await screen.findByText('Sooner Roundtable')

    expect(screen.queryByRole('columnheader', { name: 'Partners' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'TPID' })).not.toBeInTheDocument()
    narrow.unmount()

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 })
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(<QuarterlyEventsTile />)
    await screen.findAllByText('Sooner Roundtable')
    expect(screen.getByRole('columnheader', { name: 'Partners' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'TPID' })).toBeInTheDocument()
    expect(screen.getByText('Fabrikam')).toBeInTheDocument()
  })

  it('adds an event with the entered fields and clears the form', async () => {
    mockGetRecords.mockResolvedValueOnce([])
    wrap(<QuarterlyEventsTile />)

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'CXO Dinner' } })
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '2026-09-10' } })
    fireEvent.change(screen.getByLabelText(/partner/i), { target: { value: 'Contoso' } })
    fireEvent.change(screen.getByLabelText(/tpid/i), { target: { value: 'T-9' } })
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalledWith(
      'qtr_event',
      expect.any(String),
      expect.objectContaining({ eventName: 'CXO Dinner', date: '2026-09-10', partners: 'Contoso', tpid: 'T-9' }),
    ))
    expect(toast.success).toHaveBeenCalled()
    expect(screen.getByLabelText(/event name/i)).toHaveValue('')
  })

  it('blocks save with a friendly message when required fields are missing', async () => {
    mockGetRecords.mockResolvedValueOnce([])
    wrap(<QuarterlyEventsTile />)

    fireEvent.click(screen.getByRole('button', { name: /add event/i }))

    expect(await screen.findByText(/event name is required/i)).toBeInTheDocument()
    expect(mockAddRecord).not.toHaveBeenCalled()
  })

  it('blocks save with a friendly message for an invalid attachment link', async () => {
    mockGetRecords.mockResolvedValueOnce([])
    wrap(<QuarterlyEventsTile />)

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'CXO Dinner' } })
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '2026-09-10' } })
    fireEvent.change(screen.getByLabelText(/attachment/i), { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))

    expect(await screen.findByText(/valid.*url/i)).toBeInTheDocument()
    expect(mockAddRecord).not.toHaveBeenCalled()
  })

  it('renders the attachment link only when a valid URL is present, and opens it', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 })
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(<QuarterlyEventsTile />)

    await screen.findByText('Sooner Roundtable')
    const links = screen.getAllByRole('button', { name: /view file/i })
    expect(links).toHaveLength(1) // only the row with a valid attachmentUrl
    fireEvent.click(links[0])
    expect(openSpy).toHaveBeenCalledWith('https://sharepoint.example.com/list.xlsx', '_blank', 'noopener')
    openSpy.mockRestore()
  })
})
