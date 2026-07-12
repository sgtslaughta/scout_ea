import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { CommandPalette } from './CommandPalette'

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        {ui}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

it('offers a "Go to Inbox" quick command', () => {
  wrap(<CommandPalette open onOpenChange={vi.fn()} onViewChange={vi.fn()} onRefresh={vi.fn()} />)
  expect(screen.getByText('Go to Inbox')).toBeInTheDocument()
})
