import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '../theme'
import * as api from '@/api'
import TerritoryTile, { parseTerritoryRecord } from './TerritoryTile'
import { WidgetCard } from './WidgetCard'

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, getRecords: vi.fn() }
})

const mockGetRecords = vi.mocked(api.getRecords)

const records: api.RecordItem[] = [
  {
    id: 1, kind: 'territory', external_ref: 'REV-1', status: 'active', sort: 0,
    created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
    data: {
      manager: 'Jamie Lee', date: '2026-08-10T15:00:00Z', presenter: 'Sam Rivera',
      customerPlanUrl: 'https://plans.example.com/rev-1',
      attachments: [
        { kind: 'recording', label: 'Teams recording', url: 'https://sharepoint.example.com/rec-1.mp4' },
        { kind: 'deck', label: 'Deck', url: 'https://sharepoint.example.com/deck-1.pptx' },
        { kind: 'recap', label: 'Recap notes', url: 'https://sharepoint.example.com/recap-1.docx' },
      ],
    },
  },
  // no artefacts yet — review hasn't happened
  {
    id: 2, kind: 'territory', external_ref: 'REV-2', status: 'active', sort: 0,
    created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z',
    data: { manager: 'Jamie Lee', date: '2026-08-03T15:00:00Z', presenter: 'Chris Kim' },
  },
  // one artefact only
  {
    id: 3, kind: 'territory', external_ref: 'REV-3', status: 'active', sort: 0,
    created_at: '2026-07-03T00:00:00Z', updated_at: '2026-07-03T00:00:00Z',
    data: {
      manager: 'Pat Nguyen', date: '2026-08-17T15:00:00Z', presenter: 'Jo Park',
      attachments: [{ kind: 'recap', label: 'Recap', url: 'https://sharepoint.example.com/recap-3.docx' }],
    },
  },
  // malformed: no manager and no date — must be skipped, not crash
  { id: 4, kind: 'territory', external_ref: 'bad', status: 'active', sort: 0, created_at: '2026-07-04T00:00:00Z', updated_at: '2026-07-04T00:00:00Z', data: { presenter: 'Nobody' } },
]

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

describe('parseTerritoryRecord', () => {
  it('parses a full record with attachments', () => {
    const row = parseTerritoryRecord(records[0])
    expect(row?.manager).toBe('Jamie Lee')
    expect(row?.presenter).toBe('Sam Rivera')
    expect(row?.attachments).toHaveLength(3)
  })

  it('defaults attachments to an empty array when absent', () => {
    const row = parseTerritoryRecord(records[1])
    expect(row?.attachments).toEqual([])
  })

  it('keeps a single-attachment record intact', () => {
    const row = parseTerritoryRecord(records[2])
    expect(row?.attachments).toHaveLength(1)
  })

  it('returns null for a record missing both manager and date', () => {
    expect(parseTerritoryRecord(records[3])).toBeNull()
  })
})

describe('TerritoryTile', () => {
  it('renders the master schedule sorted by date, upcoming first, and skips malformed rows', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(<TerritoryTile />)

    const managers = await screen.findAllByText('Jamie Lee')
    expect(managers.length).toBeGreaterThan(0)
    expect(screen.getByText('Sam Rivera')).toBeInTheDocument()
    expect(screen.getByText('Chris Kim')).toBeInTheDocument()
    expect(screen.queryByText('Nobody')).not.toBeInTheDocument()

    // upcoming-first: REV-2 (Aug 3) before REV-1 (Aug 10) before REV-3 (Aug 17)
    const rows = screen.getAllByRole('row').slice(1) // drop header
    const text = rows.map((r) => r.textContent).join('|')
    expect(text.indexOf('Chris Kim')).toBeLessThan(text.indexOf('Sam Rivera'))
    expect(text.indexOf('Sam Rivera')).toBeLessThan(text.indexOf('Jo Park'))
  })

  it('shows the customer plan link and artefact links only in the expanded dialog', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(
      <WidgetCard title="Territory reviews" onRefresh={() => {}} onHide={() => {}}>
        <TerritoryTile />
      </WidgetCard>,
    )

    await screen.findByText('Sam Rivera')
    expect(screen.queryByRole('link', { name: /customer plan/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand territory reviews/i }))
    const planLinks = await screen.findAllByRole('link', { name: /customer plan/i })
    expect(planLinks.length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /teams recording/i })).toHaveAttribute('href', 'https://sharepoint.example.com/rec-1.mp4')
    expect(screen.getByRole('link', { name: /^deck$/i })).toHaveAttribute('href', 'https://sharepoint.example.com/deck-1.pptx')
    expect(screen.getByRole('link', { name: /recap notes/i })).toHaveAttribute('href', 'https://sharepoint.example.com/recap-1.docx')
  })

  it('shows a placeholder for a review with zero artefacts yet', async () => {
    mockGetRecords.mockResolvedValueOnce(records)
    wrap(
      <WidgetCard title="Territory reviews" onRefresh={() => {}} onHide={() => {}}>
        <TerritoryTile />
      </WidgetCard>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /expand territory reviews/i }))
    expect(await screen.findAllByText(/no artefacts yet/i)).not.toHaveLength(0)
  })
})
