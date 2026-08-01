import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '../theme'

vi.mock('./TopBar', () => ({
  TopBar: ({ onOpenDrawer }: { onOpenDrawer: (id: string) => void }) => (
    <div>
      TOPBAR
      <button onClick={() => onOpenDrawer('settings')}>Open settings</button>
      <button onClick={() => onOpenDrawer('people')}>Open people</button>
    </div>
  ),
}))
vi.mock('./LeftRail', () => ({ LeftRail: () => <div>LEFTRAIL</div> }))
vi.mock('./CenterGrid', () => ({ CenterGrid: () => <div>CENTERGRID</div> }))
vi.mock('./RightRail', () => ({ RightRail: () => <div>RIGHTRAIL</div> }))
vi.mock('./DrawerHost', () => ({
  DrawerHost: ({ activeDrawer, onClose }: { activeDrawer: string | null; onClose: () => void }) =>
    activeDrawer ? (
      <div>
        DRAWERHOST:{activeDrawer}
        <button onClick={onClose}>Close drawer</button>
      </div>
    ) : null,
}))
vi.mock('@/components/CommandPalette', () => ({
  CommandPalette: ({
    open, onOpenDrawer,
  }: { open: boolean; onOpenDrawer: (id: string) => void; onOpenChange: (o: boolean) => void; onRefresh: () => void }) =>
    open ? (
      <div>
        COMMANDPALETTE
        <button onClick={() => onOpenDrawer('automations')}>Palette: open automations</button>
      </div>
    ) : null,
}))

import { ShellLayout } from './ShellLayout'

function renderShell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <ShellLayout />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('ShellLayout', () => {
  it('renders all five regions', () => {
    renderShell()
    expect(screen.getByText('TOPBAR')).toBeInTheDocument()
    expect(screen.getByText('LEFTRAIL')).toBeInTheDocument()
    expect(screen.getByText('CENTERGRID')).toBeInTheDocument()
    expect(screen.getByText('RIGHTRAIL')).toBeInTheDocument()
    // DrawerHost renders nothing until a drawer is opened.
    expect(screen.queryByText(/^DRAWERHOST/)).not.toBeInTheDocument()
  })

  it('opening a drawer from TopBar passes the id through to DrawerHost', async () => {
    renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByText('DRAWERHOST:settings')).toBeInTheDocument()
  })

  it('closing resets the active drawer to null', async () => {
    renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close drawer' }))
    expect(screen.queryByText(/^DRAWERHOST/)).not.toBeInTheDocument()
  })

  it('only one drawer is open at a time', async () => {
    renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByText('DRAWERHOST:settings')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open people' }))
    expect(screen.queryByText('DRAWERHOST:settings')).not.toBeInTheDocument()
    expect(screen.getByText('DRAWERHOST:people')).toBeInTheDocument()
  })

  it('hides the rails below the `lg` breakpoint and shows them above it', () => {
    // jsdom doesn't evaluate @media queries when resolving getComputedStyle,
    // so asserting `display` directly against a real viewport isn't reliable
    // here (same reason no other test in this repo asserts on matchMedia).
    // Instead assert on the emitted CSS itself: MUI's `{ xs: 'none', lg: 'flex' }`
    // compiles to one rule under `min-width:0px` (i.e. always-on, the base/xs
    // rule) and a second under `min-width:1200px` (the `lg` override).
    renderShell()
    const leftRailWrap = screen.getByText('LEFTRAIL').parentElement as HTMLElement
    const rightRailWrap = screen.getByText('RIGHTRAIL').parentElement as HTMLElement
    const css = document.head.innerHTML

    for (const wrap of [leftRailWrap, rightRailWrap]) {
      const cls = [...wrap.classList].find((c) => c.startsWith('css-'))!
      expect(css).toContain(`@media (min-width:0px){.${cls}{display:none;}}`)
      expect(css).toContain(`@media (min-width:1200px){.${cls}{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;}}`)
    }
  })

  it('Ctrl+K opens the command palette', async () => {
    renderShell()
    expect(screen.queryByText('COMMANDPALETTE')).not.toBeInTheDocument()
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(screen.getByText('COMMANDPALETTE')).toBeInTheDocument()
  })

  it('selecting a drawer entry in the command palette opens it in DrawerHost — same state as TopBar', async () => {
    renderShell()
    await userEvent.keyboard('{Control>}k{/Control}')
    await userEvent.click(screen.getByRole('button', { name: 'Palette: open automations' }))
    expect(screen.getByText('DRAWERHOST:automations')).toBeInTheDocument()
  })
})
