import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { BriefingSections } from './BriefingSections'
import type { BriefingResponse } from '@/api'

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

  it('surfaces the signal `why` field in the risk row detail popover', async () => {
    const briefing = {
      risks: [{ id: 1, rank: 1, score: 80, title: 'Vendor risk', summary: 'short summary',
        why: 'Contract renews Friday with no signed renewal yet', created_at: '2026-07-25T09:00:00Z' }],
      opportunities: [],
      critical: [], news_by_topic: [], people: [],
    } as unknown as BriefingResponse
    render(
      <ThemeProvider theme={theme}>
        <BriefingSections briefing={briefing} onNavigate={() => {}} />
      </ThemeProvider>,
    )
    await userEvent.hover(screen.getByText('Vendor risk'))
    expect(await screen.findByText(/Contract renews Friday with no signed renewal yet/)).toBeInTheDocument()
  })
})
