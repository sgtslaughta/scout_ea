import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '../theme'
import { AxisCluster, type AxisDot } from './AxisCluster'
import type { Urgency } from '@/lib/horizon'

const dot: AxisDot = { key: 'd1', id: 1, title: 'Ship it', when: new Date().toISOString(), type: 'deadline' }

function renderCluster(urgency: Urgency) {
  return render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <MemoryRouter>
        <AxisCluster percent={50} items={[dot]} color="red" urgency={urgency} compactWhen={() => '1h'} />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('AxisCluster radar-ping', () => {
  it('renders a ping halo for critical urgency', () => {
    renderCluster('critical')
    expect(screen.getByTestId('axis-ping')).toBeInTheDocument()
  })

  it('renders a ping halo for urgent urgency', () => {
    renderCluster('urgent')
    expect(screen.getByTestId('axis-ping')).toBeInTheDocument()
  })

  it('does NOT ping for soon/normal urgency', () => {
    renderCluster('normal')
    expect(screen.queryByTestId('axis-ping')).toBeNull()
  })
})
