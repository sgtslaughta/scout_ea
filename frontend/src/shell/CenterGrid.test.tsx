import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import type { DragEndEvent } from '@dnd-kit/core'
import { theme } from '../theme'
import { CenterGrid, createDragEndHandler } from './CenterGrid'
import { WIDGETS } from '../widgets/registry'
import { LAYOUT_KEY, defaultLayout, saveLayout } from '../widgets/layout'
import type { DashboardLayout } from '../widgets/layout'

const ALL_KEYS = WIDGETS.map((w) => w.key)

beforeEach(() => {
  localStorage.clear()
})

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <CenterGrid />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('CenterGrid', () => {
  it('renders every registered widget title', async () => {
    wrap()
    for (const w of WIDGETS) {
      expect(await screen.findByText(w.title)).toBeInTheDocument()
    }
  })

  it('spans lg widgets across both columns and sm widgets across one', async () => {
    wrap()
    const lgDef = WIDGETS.find((w) => w.size === 'lg')!
    const smDef = WIDGETS.find((w) => w.size === 'sm')!
    const lgHeading = await screen.findByText(lgDef.title)
    const smHeading = await screen.findByText(smDef.title)
    expect(lgHeading.closest('[data-widget-tile]')).toHaveStyle({ gridColumn: 'span 2' })
    expect(smHeading.closest('[data-widget-tile]')).toHaveStyle({ gridColumn: 'span 1' })
  })

  it('hiding a widget via its card removes it and persists the hidden key', async () => {
    wrap()
    const first = WIDGETS[0]
    const hideBtn = await screen.findByRole('button', { name: new RegExp(`hide ${first.title}`, 'i') })
    fireEvent.click(hideBtn)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!) as DashboardLayout
      expect(stored.hidden).toContain(first.key)
    })
    expect(screen.queryByText(first.title)).toBeNull()
  })

  it('manage tiles menu lists every widget and toggles visibility, persisting the change', async () => {
    wrap()
    const manageBtn = await screen.findByRole('button', { name: /manage tiles/i })
    fireEvent.click(manageBtn)
    const items = await screen.findAllByRole('menuitemcheckbox')
    expect(items.length).toBe(WIDGETS.length)
    fireEvent.click(items[0])
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!) as DashboardLayout
      expect(stored.hidden.length).toBe(1)
    })
  })

  it('reset restores the default layout', async () => {
    saveLayout({ order: [...ALL_KEYS].reverse(), hidden: [ALL_KEYS[0]] })
    wrap()
    const resetBtn = await screen.findByRole('button', { name: /reset/i })
    fireEvent.click(resetBtn)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!) as DashboardLayout
      expect(stored).toEqual(defaultLayout(ALL_KEYS))
    })
    for (const w of WIDGETS) {
      expect(await screen.findByText(w.title)).toBeInTheDocument()
    }
  })

  it('refresh invalidates that widget\'s query keys', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <CenterGrid />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    )
    const def = WIDGETS[0]
    const refreshBtn = await screen.findByRole('button', { name: new RegExp(`refresh ${def.title}`, 'i') })
    fireEvent.click(refreshBtn)
    for (const qk of def.queryKeys) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: qk })
    }
  })
})

describe('createDragEndHandler', () => {
  it('reorders and persists to localStorage under ea-dashboard-layout when dropped on a different tile', () => {
    const layout = defaultLayout(ALL_KEYS)
    let current = layout
    const setLayout = (next: DashboardLayout) => {
      current = next
      saveLayout(next)
    }
    const handleDragEnd = createDragEndHandler(layout, setLayout)
    const activeKey = layout.order[0]
    const overKey = layout.order[2]
    handleDragEnd({ active: { id: activeKey }, over: { id: overKey } } as DragEndEvent)
    expect(current.order[2]).toBe(activeKey)
    const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!) as DashboardLayout
    expect(stored.order[2]).toBe(activeKey)
  })

  it('is a no-op when dropped on itself', () => {
    const layout = defaultLayout(ALL_KEYS)
    const setLayout = vi.fn()
    const handleDragEnd = createDragEndHandler(layout, setLayout)
    handleDragEnd({ active: { id: layout.order[0] }, over: { id: layout.order[0] } } as DragEndEvent)
    expect(setLayout).not.toHaveBeenCalled()
  })

  it('is a no-op when dropped with no over target', () => {
    const layout = defaultLayout(ALL_KEYS)
    const setLayout = vi.fn()
    const handleDragEnd = createDragEndHandler(layout, setLayout)
    handleDragEnd({ active: { id: layout.order[0] }, over: null } as DragEndEvent)
    expect(setLayout).not.toHaveBeenCalled()
  })
})
