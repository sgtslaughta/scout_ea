// frontend/src/views/SetupWizard.step3.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './../api'
import { SetupWizard } from './SetupWizard'

beforeEach(() => {
  vi.spyOn(api, 'getMcpConfig').mockResolvedValue({ url: 'u', token: 't', configured: true })
  vi.spyOn(api, 'getConfig').mockResolvedValue({ mcp_name: 'my-scout' })
  vi.spyOn(api, 'getMcpStatus').mockResolvedValue({ last_seen: null })
  vi.spyOn(api, 'getSkills').mockResolvedValue([{ name: 'triage_email', description: 'd', body: 'b' }])
  vi.spyOn(api, 'setConfig').mockResolvedValue({ key: 'wizard_done', value: '1' })
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

async function goToAutomations() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByRole('button', { name: /next/i }))
  fireEvent.click(await screen.findByRole('button', { name: /next/i }))
}

describe('Step 3 Automations', () => {
  it('copies the action string for a skill', async () => {
    await goToAutomations()
    fireEvent.click(await screen.findByRole('button', { name: /copy action/i }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Run the 'triage_email' skill"))
  })
  it('Finish marks wizard_done', async () => {
    await goToAutomations()
    fireEvent.click(await screen.findByRole('button', { name: /finish/i }))
    await waitFor(() => expect(api.setConfig).toHaveBeenCalledWith('wizard_done', '1'))
  })
})
