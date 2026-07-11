import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimePrefsProvider } from '@/lib/timePrefs'
import { theme } from '../../theme'
import { RecentActivitySection } from './RecentActivitySection'
import * as api from '@/api'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        <TimePrefsProvider>{ui}</TimePrefsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.spyOn(api, 'getActivity').mockResolvedValue([{ id: 1, skill: 'news_search', ran_at: new Date().toISOString(), items_created: 3, status: 'ok' }])
})

describe('RecentActivitySection', () => {
  it('lists a recent skill run', async () => {
    wrap(<RecentActivitySection collapsed={false} onToggle={vi.fn()} />)
    expect(await screen.findByText('news_search')).toBeInTheDocument()
  })
})
