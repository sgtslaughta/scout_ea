import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import PlaceholderTile from './PlaceholderTile'
import { WidgetCard } from './WidgetCard'

describe('PlaceholderTile', () => {
  it('publishes a count of 0 via useWidgetCount', () => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <WidgetCard title="T" onRefresh={() => {}} onHide={() => {}}>
            <PlaceholderTile />
          </WidgetCard>
        </MemoryRouter>
      </ThemeProvider>,
    )
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
