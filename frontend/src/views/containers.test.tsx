import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Stub the heavy child views so this test only proves tab wiring.
vi.mock('./Skills', () => ({ SkillsView: () => <div>SKILLS VIEW</div> }))
vi.mock('./Activity', () => ({ ActivityView: () => <div>ACTIVITY VIEW</div> }))

import { AutomationsView } from './Automations'

function wrap(node: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('container views', () => {
  it('Automations shows Skills + Activity tabs', () => {
    wrap(<AutomationsView />)
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument()
  })
})
