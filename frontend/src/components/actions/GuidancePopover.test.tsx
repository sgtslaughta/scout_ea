import { it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import * as api from '../../api'
import { GuidancePopover } from './GuidancePopover'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}>
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
  </QueryClientProvider>)

it('adds a guidance note for the scope', async () => {
  vi.spyOn(api, 'getGuidance').mockResolvedValue([])
  const add = vi.spyOn(api, 'addGuidance').mockResolvedValue({ id: 1 })
  wrap(<GuidancePopover scope="topic:AI" />)
  fireEvent.click(screen.getByRole('button', { name: /guidance/i }))
  fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'ignore vendor spam' } })
  fireEvent.click(screen.getByRole('button', { name: /add/i }))
  await waitFor(() => expect(add).toHaveBeenCalledWith('topic:AI', 'ignore vendor spam'))
})
