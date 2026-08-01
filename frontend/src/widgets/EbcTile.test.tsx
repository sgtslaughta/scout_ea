import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import EbcTile, { EBC_ACTIONS } from './EbcTile'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, getRecords: vi.fn(), addRecord: vi.fn(async () => ({ id: 1 })) }
})

const mockGetRecords = vi.mocked(api.getRecords)
const mockAddRecord = vi.mocked(api.addRecord)

afterEach(() => vi.clearAllMocks())

const records: api.RecordItem[] = [
  {
    id: 1, kind: 'ebc', external_ref: 'ebc-1', status: 'active', sort: 0,
    created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
    data: {
      date: '2026-08-05', customer: 'Contoso', accountExec: 'Alex Exec',
      leadPlanner: 'Jamie Planner', myAction: 'Planning',
    },
  },
  // MSXI-supplied fields only — no user-entered fields yet, should still render
  {
    id: 2, kind: 'ebc', external_ref: 'ebc-2', status: 'active', sort: 0,
    created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z',
    data: { date: '2026-08-10', customer: 'Fabrikam' },
  },
  // malformed: no date and no customer at all — must be skipped, not crash
  {
    id: 3, kind: 'ebc', external_ref: 'ebc-3', status: 'active', sort: 0,
    created_at: '2026-07-03T00:00:00Z', updated_at: '2026-07-03T00:00:00Z',
    data: { someUnknownMsxiField: 'huh' },
  },
]

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('EbcTile', () => {
  it('renders rows with MSXI fields, tolerates missing fields, skips malformed rows', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(<EbcTile />)

    expect(await screen.findByText('Contoso')).toBeInTheDocument()
    expect(screen.getByText('Fabrikam')).toBeInTheDocument()
    expect(screen.queryByText('huh')).not.toBeInTheDocument()
  })

  it('exposes the action choices from the exported EBC_ACTIONS constant', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(<EbcTile />)
    await screen.findByText('Contoso')

    const select = screen.getByLabelText(/my action for contoso/i)
    fireEvent.mouseDown(select)
    for (const action of EBC_ACTIONS) {
      expect(screen.getByRole('option', { name: action })).toBeInTheDocument()
    }
  })

  it('merges an edit into the existing blob instead of overwriting MSXI fields', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(<EbcTile />)
    await screen.findByText('Contoso')

    const select = screen.getByLabelText(/my action for contoso/i)
    fireEvent.mouseDown(select)
    fireEvent.click(screen.getByRole('option', { name: 'Done' }))

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalledWith(
      'ebc', 'ebc-1',
      {
        date: '2026-08-05', customer: 'Contoso', accountExec: 'Alex Exec',
        leadPlanner: 'Jamie Planner', myAction: 'Done',
      },
      'active', 0,
    ))
    expect(toast.error).not.toHaveBeenCalled()
  })
})
