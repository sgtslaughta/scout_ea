import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocsView } from './Docs'
import { vi } from 'vitest'

// ponytail: render-only test, no interactions needed for pass 2 verification
describe('Docs view', () => {
  it('renders Skills Library header', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }))

    render(
      <QueryClientProvider client={qc}>
        <DocsView />
      </QueryClientProvider>
    )

    const heading = screen.getByText('Skills Library')
    if (!heading) throw new Error('Skills Library header not found')
  })
})
