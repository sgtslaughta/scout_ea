import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { WidgetCard, useWidgetCount, useWidgetExpanded } from './WidgetCard'

function wrap(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  )
}

afterEach(cleanup)

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
      <WidgetCard title="Deadlines" onRefresh={noop} onHide={noop}>
        <div>hello</div>
      </WidgetCard>,
    )
    expect(screen.getByText('Deadlines')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('isolates child errors behind an Alert', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    wrap(
      <WidgetCard title="Broken" onRefresh={noop} onHide={noop}>
        <Boom />
      </WidgetCard>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/Broken/)
    spy.mockRestore()
  })

  it('publishes child count into the chrome chip', () => {
    wrap(
      <WidgetCard title="Signals" onRefresh={noop} onHide={noop}>
        <Counter />
      </WidgetCard>,
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('fires toolbar callbacks', () => {
    const onHide = vi.fn()
    const onRefresh = vi.fn()
    wrap(
      <WidgetCard title="T" onRefresh={onRefresh} onHide={onHide}>
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
      <WidgetCard title="A" onRefresh={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    expect(screen.queryByRole('button', { name: /open a/i })).toBeNull()
    wrap(
      <WidgetCard title="B" drillDown="/deadlines" onRefresh={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    expect(screen.getByRole('button', { name: /open b/i })).toBeInTheDocument()
  })

  it('invokes function-form drillDown instead of navigating', () => {
    const onOpen = vi.fn()
    wrap(
      <WidgetCard title="C" drillDown={onOpen} onRefresh={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: /open c/i }))
    expect(onOpen).toHaveBeenCalled()
  })

  it('expand opens a dialog re-rendering children', () => {
    wrap(
      <WidgetCard title="E" onRefresh={noop} onHide={noop}>
        <div>inner-content</div>
      </WidgetCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: /expand e/i }))
    expect(screen.getAllByText('inner-content').length).toBe(2)
  })

  it('renders an always-focusable drag handle with sortable aria', () => {
    wrap(
      <WidgetCard title="D" onRefresh={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    const handle = screen.getByRole('button', { name: /reorder d/i })
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable')
    handle.focus()
    expect(handle).toHaveFocus()
  })

  it('renders the empty state when count is 0 and emptyState is supplied, not otherwise', () => {
    const emptyState = { message: 'Nothing here yet' }
    const { unmount } = wrap(
      <WidgetCard title="Empty" onRefresh={noop} onHide={noop} emptyState={emptyState}>
        <Counter />
      </WidgetCard>,
    )
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.queryByText('Nothing here yet')).toBeNull()
    unmount()

    function Zero() {
      useWidgetCount(0)
      return <div>real-content</div>
    }
    wrap(
      <WidgetCard title="Empty" onRefresh={noop} onHide={noop} emptyState={emptyState}>
        <Zero />
      </WidgetCard>,
    )
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.getByText('real-content')).not.toBeVisible()
  })

  it('shows a settings gear only when settings is supplied, opening a popover', () => {
    const { unmount } = wrap(
      <WidgetCard title="Plain" onRefresh={noop} onHide={noop}>
        <div />
      </WidgetCard>,
    )
    expect(screen.queryByRole('button', { name: /settings/i })).toBeNull()
    unmount()

    function Settings() {
      return <div>settings-panel</div>
    }
    wrap(
      <WidgetCard title="Fancy" onRefresh={noop} onHide={noop} settings={Settings}>
        <div />
      </WidgetCard>,
    )
    const gear = screen.getByRole('button', { name: /settings/i })
    fireEvent.click(gear)
    expect(screen.getByText('settings-panel')).toBeInTheDocument()
  })
})

describe('useWidgetExpanded', () => {
  function Probe() {
    useWidgetCount(1)
    return <div>{useWidgetExpanded() ? 'expanded' : 'compact'}</div>
  }

  it('reports compact in the grid and expanded inside the dialog', () => {
    wrap(
      <WidgetCard title="Feed" onRefresh={noop} onHide={noop}>
        <Probe />
      </WidgetCard>,
    )
    // Only the in-grid copy exists until the dialog is opened.
    expect(screen.getByText('compact')).toBeInTheDocument()
    expect(screen.queryByText('expanded')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /expand feed/i }))

    // Both copies are mounted once expanded; the dialog's reports expanded so a
    // capped tile can render its full list there.
    expect(screen.getByText('expanded')).toBeInTheDocument()
    expect(screen.getByText('compact')).toBeInTheDocument()
  })
})
