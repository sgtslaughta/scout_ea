import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '@/api'
import ChatTile from './ChatTile'

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, getRecords: vi.fn(async () => []) }
})

const mockGetRecords = vi.mocked(api.getRecords)

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('ChatTile', () => {
  it('fetches chat records', async () => {
    wrap(<ChatTile />)
    expect(await screen.findByText('0 unread')).toBeInTheDocument()
    expect(mockGetRecords).toHaveBeenCalledWith('chat')
  })
})
