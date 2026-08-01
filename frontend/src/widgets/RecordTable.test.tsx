import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '@/api'
import { RecordTable } from './RecordTable'
import type { RecordColumn } from './RecordTable'

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, createTask: vi.fn(async () => ({ id: 1 })) }
})

afterEach(() => vi.clearAllMocks())

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

interface Row { id: number; name: string; detail: string }

const rows: Row[] = [
  { id: 1, name: 'Contoso', detail: 'alpha' },
  { id: 2, name: 'Fabrikam', detail: 'beta' },
]

const columns: RecordColumn<Row>[] = [
  { key: 'name', header: 'Name', compact: true, render: (r) => r.name },
  { key: 'detail', header: 'Detail', render: (r, { dense }) => (dense ? `d:${r.detail}` : `full:${r.detail}`) },
]

describe('RecordTable', () => {
  it('renders only compact columns when the container is narrow', () => {
    render(<RecordTable rows={rows} columns={columns} getRowId={(r) => r.id} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.queryByText('Detail')).not.toBeInTheDocument()
    expect(screen.getByText('Contoso')).toBeInTheDocument()
    expect(screen.getByText('Fabrikam')).toBeInTheDocument()
  })

  it('renders all columns and passes dense=false once the container is wide', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 })
    render(<RecordTable rows={rows} columns={columns} getRowId={(r) => r.id} />)
    expect(screen.getByText('Detail')).toBeInTheDocument()
    expect(screen.getByText('full:alpha')).toBeInTheDocument()
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 0 })
  })

  it('shows the empty message and no table when there are no rows', () => {
    render(<RecordTable rows={[]} columns={columns} getRowId={(r: Row) => r.id} emptyMessage="Nothing tracked yet." />)
    expect(screen.getByText('Nothing tracked yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders one task button per row, skipping rows where rowTask returns null', () => {
    wrap(
      <RecordTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        rowTask={(r) => (r.name === 'Contoso' ? { title: `Follow up: ${r.name}` } : null)}
      />,
    )
    expect(screen.getAllByRole('button', { name: /create a task from this/i })).toHaveLength(1)
  })

  it('renders no task buttons when rowTask is not supplied', () => {
    wrap(<RecordTable rows={rows} columns={columns} getRowId={(r) => r.id} />)
    expect(screen.queryByRole('button', { name: /create a task from this/i })).not.toBeInTheDocument()
  })
})
