import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TabbedView } from './TabbedView'

const tabs = [
  { id: 'one', label: 'One', element: <div>PANEL ONE</div> },
  { id: 'two', label: 'Two', element: <div>PANEL TWO</div> },
]

function wrap(initial = '/x') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <TabbedView tabs={tabs} ariaLabel="test tabs" />
    </MemoryRouter>,
  )
}

describe('TabbedView', () => {
  it('shows first tab panel by default', () => {
    wrap()
    expect(screen.getByText('PANEL ONE')).toBeInTheDocument()
    expect(screen.queryByText('PANEL TWO')).toBeNull()
  })
  it('honors ?tab= in the url', () => {
    wrap('/x?tab=two')
    expect(screen.getByText('PANEL TWO')).toBeInTheDocument()
  })
  it('switches panel on tab click', () => {
    wrap()
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
    expect(screen.getByText('PANEL TWO')).toBeInTheDocument()
  })
  it('falls back to first tab for an unknown ?tab=', () => {
    wrap('/x?tab=nope')
    expect(screen.getByText('PANEL ONE')).toBeInTheDocument()
  })
})
