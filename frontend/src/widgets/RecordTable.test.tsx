import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecordTable } from './RecordTable'
import type { RecordColumn } from './RecordTable'

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
})
