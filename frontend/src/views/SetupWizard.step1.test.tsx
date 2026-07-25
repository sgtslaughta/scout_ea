import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './../api'
import { SetupWizard } from './SetupWizard'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(api, 'getMcpConfig').mockResolvedValue({ url: 'http://localhost:8766/mcp', token: 'tok', configured: true })
  vi.spyOn(api, 'getConfig').mockResolvedValue({ mcp_name: 'scout-ea' })
  vi.spyOn(api, 'setConfig').mockResolvedValue({ key: 'mcp_name', value: 'x' })
  vi.spyOn(api, 'getMcpStatus').mockResolvedValue({ last_seen: null })
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('Step 1 Connect', () => {
  it('renders MCP url and persists a renamed connection', async () => {
    render(<SetupWizard />)
    expect(await screen.findByDisplayValue('scout-ea')).toBeInTheDocument()
    const field = screen.getByLabelText(/connection name/i)
    fireEvent.change(field, { target: { value: 'my-scout' } })
    fireEvent.blur(field)
    await waitFor(() => expect(api.setConfig).toHaveBeenCalledWith('mcp_name', 'my-scout'))
  })
  it('copies the token', async () => {
    render(<SetupWizard />)
    fireEvent.click(await screen.findByRole('button', { name: /copy token/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('tok'))
  })
})
