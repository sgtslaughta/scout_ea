import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import ThemeSelectionProvider from '../themes/ThemeSelectionProvider'
import { SettingsView } from './Settings'
import * as push from '@/lib/push'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function renderSettings() {
  return render(
    <ThemeSelectionProvider>
      <SettingsView />
    </ThemeSelectionProvider>,
  )
}

describe('Settings view', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders Settings header', () => {
    renderSettings()
    const heading = screen.getByText('Settings')
    expect(heading).toBeDefined()
  })

  it('wires theme mode selection to ea-theme localStorage', () => {
    localStorage.setItem('ea-theme', 'dark')
    renderSettings()
    const lightButton = screen.getByRole('button', { name: /light/i })
    fireEvent.click(lightButton)
    expect(localStorage.getItem('ea-theme')).toBe('light')
  })

  it('test-notification toast reflects sent count', async () => {
    vi.spyOn(push, 'sendTestPush').mockResolvedValue(3)
    vi.spyOn(push, 'getSubscriptionState').mockResolvedValue('subscribed')
    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: /send test/i }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Sent to 3 subscription(s)'))
  })

  it('test-notification with zero subscriptions shows an info toast', async () => {
    vi.spyOn(push, 'sendTestPush').mockResolvedValue(0)
    vi.spyOn(push, 'getSubscriptionState').mockResolvedValue('subscribed')
    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: /send test/i }))
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'No active subscriptions — enable notifications first (requires a real browser + push service)',
      ),
    )
  })

  it('theme picker lists all themes and selecting persists', async () => {
    localStorage.clear()
    renderSettings()
    const cyber = await screen.findByRole('button', { name: /cyberpunk/i })
    fireEvent.click(cyber)
    await waitFor(() => expect(localStorage.getItem('ea-theme-name')).toBe('cyberpunk'))
  })
})
