import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { WidgetCard, useWidgetCount } from './WidgetCard'

function wrap(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  )
}

const noop = () => {}

function Boom(): React.ReactNode {
  throw new Error('widget exploded')
}

function Counter() {
  useWidgetCount(42)
  return <div>content</div>
}

describe('WidgetCard', () => {
  it('renders title and children', () => {
    wrap(
      <WidgetCard title="Deadlines" onRefresh={noop} onMove={noop} onHide={noop}>
        <div>hello</div>
      </WidgetCard>,
    )
    expect(screen.getByText('Deadlines')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('isolates child errors behind an Alert', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    wrap(
      <WidgetCard title="Broken" onRefresh={noop} onMove={noop} onHide={noop}>
        <Boom />
      </WidgetCard>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/Broken/)
    spy.mockRestore()
  })

  it('publishes child count into the chrome chip', () => {
    wrap(
      <WidgetCard title="Signals" onRefresh={noop} onMove={noop} onHide={noop}>
        <Counter />
      </WidgetCard>,
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('fires toolbar callbacks', () => {
    const onHide = vi.fn()
    const onRefresh = vi.fn()
    wrap(
      <WidgetCard title="T" onRefresh={onRefresh} onMove={noop} onHide={onHide}>
        <div />
      </WidgetCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: /refresh t/i }))
    fireEvent.click(screen.getByRole('button', { name: /hide t/i }))
    expect(onRefresh).toHaveBeenCalled()
    expect(onHide).toHaveBeenCalled()
  })

  it('omits open button without drillDown, shows it with one', () => {
    wrap(
      <WidgetCard title="A" onRefresh={noop} onMove={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    expect(screen.queryByRole('button', { name: /open a/i })).toBeNull()
    wrap(
      <WidgetCard title="B" drillDown="/deadlines" onRefresh={noop} onMove={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    expect(screen.getByRole('button', { name: /open b/i })).toBeInTheDocument()
  })

  it('expand opens a dialog re-rendering children', () => {
    wrap(
      <WidgetCard title="E" onRefresh={noop} onMove={noop} onHide={noop}>
        <div>inner-content</div>
      </WidgetCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: /expand e/i }))
    expect(screen.getAllByText('inner-content').length).toBe(2)
  })
})
