import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import PipelineTile from './PipelineTile'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, getRecords: vi.fn(), addRecord: vi.fn(async () => ({ id: 1 })), getConfig: vi.fn() }
})

const mockGetRecords = vi.mocked(api.getRecords)
const mockAddRecord = vi.mocked(api.addRecord)
const mockGetConfig = vi.mocked(api.getConfig)

afterEach(() => vi.clearAllMocks())

const records: api.RecordItem[] = [
  {
    id: 1, kind: 'pipeline', external_ref: 'OPP-1', status: 'active', sort: 0,
    created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
    data: {
      customer: 'Contoso', accountExec: 'Alex Exec', tpid: 'T-1', opportunityId: 'OPP-1',
      totalValue: 1250000, workload: 'Azure', salesTagId: 'TAG-1', status: 'Committed',
    },
  },
  // stub row: user tracked it, Scout hasn't enriched it yet
  { id: 2, kind: 'pipeline', external_ref: 'T-2', status: 'pending', sort: 0, created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z', data: { tpid: 'T-2' } },
  // malformed: neither tpid nor opportunityId — must be skipped, not crash
  { id: 3, kind: 'pipeline', external_ref: 'bad', status: 'active', sort: 0, created_at: '2026-07-03T00:00:00Z', updated_at: '2026-07-03T00:00:00Z', data: { customer: 'No key' } },
]

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('PipelineTile', () => {
  it('renders tracked opportunities and skips malformed rows', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    mockGetConfig.mockResolvedValueOnce({})
    wrap(<PipelineTile />)

    expect(await screen.findByText('Contoso')).toBeInTheDocument()
    // stub row (no customer/workload yet) still shows via its pending status
    expect(screen.getByText('pending lookup')).toBeInTheDocument()
    expect(screen.queryByText('No key')).not.toBeInTheDocument()
  })

  it('submits a pending stub record with the entered TPID and sales tag', async () => {
    mockGetRecords.mockResolvedValueOnce([])
    mockGetConfig.mockResolvedValueOnce({})
    wrap(<PipelineTile />)

    fireEvent.change(screen.getByLabelText(/tpid/i), { target: { value: 'T-9' } })
    fireEvent.change(screen.getByLabelText(/sales tag/i), { target: { value: 'TAG-9' } })
    fireEvent.click(screen.getByRole('button', { name: /track/i }))

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalledWith(
      'pipeline', 'T-9', { tpid: 'T-9', salesTagId: 'TAG-9' }, 'pending',
    ))
    expect(toast.success).toHaveBeenCalled()
  })

  it('hides the MSX dashboard link when unconfigured, shows it when configured', async () => {
    mockGetRecords.mockResolvedValueOnce([])
    mockGetConfig.mockResolvedValueOnce({})
    wrap(<PipelineTile />)
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: /msx/i })).not.toBeInTheDocument()

    mockGetRecords.mockResolvedValueOnce([])
    mockGetConfig.mockResolvedValueOnce({ msx_dashboard_url: 'https://msx.example.com/dash' })
    wrap(<PipelineTile />)
    const link = await screen.findByRole('link', { name: /msx/i })
    expect(link).toHaveAttribute('href', 'https://msx.example.com/dash')
  })
})
