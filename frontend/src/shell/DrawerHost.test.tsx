import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DrawerHost } from './DrawerHost'

const settingsMount = vi.fn()
const peopleMount = vi.fn()
const automationsMount = vi.fn()
const wizardMount = vi.fn()

vi.mock('@/views/Settings', () => ({
  SettingsView: () => {
    settingsMount()
    return <div>settings-view</div>
  },
}))
vi.mock('@/views/People', () => ({
  PeopleView: () => {
    peopleMount()
    return <div>people-view</div>
  },
}))
vi.mock('@/views/Automations', () => ({
  AutomationsView: () => {
    automationsMount()
    return <div>automations-view</div>
  },
}))
vi.mock('@/views/SetupWizard', () => ({
  SetupWizard: () => {
    wizardMount()
    return <div>wizard-view</div>
  },
}))

describe('DrawerHost', () => {
  beforeEach(() => {
    settingsMount.mockClear()
    peopleMount.mockClear()
    automationsMount.mockClear()
    wizardMount.mockClear()
  })

  it('renders nothing when activeDrawer is null', () => {
    render(<DrawerHost activeDrawer={null} onClose={() => {}} />)
    expect(screen.queryByText('settings-view')).toBeNull()
    expect(screen.queryByText('people-view')).toBeNull()
    expect(screen.queryByText('automations-view')).toBeNull()
    expect(screen.queryByText('wizard-view')).toBeNull()
  })

  it('renders the settings view in a drawer', async () => {
    render(<DrawerHost activeDrawer="settings" onClose={() => {}} />)
    expect(await screen.findByText('settings-view')).toBeInTheDocument()
  })

  it('renders the people view in a drawer', async () => {
    render(<DrawerHost activeDrawer="people" onClose={() => {}} />)
    expect(await screen.findByText('people-view')).toBeInTheDocument()
  })

  it('renders the automations view in a drawer', async () => {
    render(<DrawerHost activeDrawer="automations" onClose={() => {}} />)
    expect(await screen.findByText('automations-view')).toBeInTheDocument()
  })

  it('renders the wizard view in a dialog', async () => {
    render(<DrawerHost activeDrawer="wizard" onClose={() => {}} />)
    expect(await screen.findByText('wizard-view')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders non-wizard drawers as a MUI Drawer, not a Dialog', async () => {
    render(<DrawerHost activeDrawer="settings" onClose={() => {}} />)
    await screen.findByText('settings-view')
    expect(document.querySelector('.MuiDrawer-root')).not.toBeNull()
    expect(document.querySelector('.MuiDialog-root')).toBeNull()
  })

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn()
    render(<DrawerHost activeDrawer="settings" onClose={onClose} />)
    await screen.findByText('settings-view')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a large, readable title matching the drawer label', async () => {
    render(<DrawerHost activeDrawer="settings" onClose={() => {}} />)
    await screen.findByText('settings-view')
    const heading = screen.getByRole('heading', { name: 'Settings' })
    expect(heading).toBeInTheDocument()
  })

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn()
    render(<DrawerHost activeDrawer="settings" onClose={onClose} />)
    await screen.findByText('settings-view')
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('remounts the child on reopen instead of reusing a stale instance', async () => {
    const { rerender } = render(<DrawerHost activeDrawer="settings" onClose={() => {}} />)
    await screen.findByText('settings-view')
    expect(settingsMount).toHaveBeenCalledTimes(1)

    rerender(<DrawerHost activeDrawer={null} onClose={() => {}} />)
    await waitFor(() => expect(screen.queryByText('settings-view')).toBeNull())

    rerender(<DrawerHost activeDrawer="settings" onClose={() => {}} />)
    await screen.findByText('settings-view')
    expect(settingsMount).toHaveBeenCalledTimes(2)
  })
})
