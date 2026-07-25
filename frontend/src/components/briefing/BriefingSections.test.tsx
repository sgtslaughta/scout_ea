import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { BriefingSections } from './BriefingSections'

describe('BriefingSections', () => {
  it('section card background uses the paper channel CSS variable, not a baked-in white rgba', () => {
    render(
      <ThemeProvider theme={theme}>
        <BriefingSections briefing={undefined} onNavigate={() => {}} />
      </ThemeProvider>,
    )
    const cards = screen.getAllByTestId('briefing-section')
    const bg = window.getComputedStyle(cards[0]).backgroundColor
    // Must reference the runtime CSS variable so dark mode resolves correctly.
    expect(bg).toContain('var(--mui-palette-background-paperChannel')
    // Must NOT be the baked-in light-mode literal.
    expect(bg).not.toBe('rgba(255, 255, 255, 0.72)')
  })
})
