import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { ACTION_SPECS } from '../../lib/actions'
import * as api from '../../api'
import { ActionComposeModal } from './ActionComposeModal'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) =>
  render(<ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>)

describe('ActionComposeModal', () => {
  it('submits an email draft with entered fields', async () => {
    const spy = vi.spyOn(api, 'createAction').mockResolvedValue({ id: 1 })
    wrap(<ActionComposeModal open spec={ACTION_SPECS.email_new}
          entity={{ type: 'signal', id: 9 }} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: /To/i }), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Subject/i }), { target: { value: 'Hi' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Body/i }), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      action_type: 'email_new', entity_type: 'signal', entity_id: 9, approve: false,
      payload: { to: 'a@b.com', subject: 'Hi', body: 'Hello' },
    })))
  })
})
