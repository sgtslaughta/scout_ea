import { render } from '@testing-library/react'
import { screen } from '@testing-library/react'
import { SkyBackdrop, skyGradients } from './SkyBackdrop'

describe('SkyBackdrop', () => {
  it('renders the correct gradient for the given phase', () => {
    const { rerender } = render(<SkyBackdrop phase="dusk" />)
    const el = screen.getByTestId('sky-backdrop')
    const computedStyle = window.getComputedStyle(el)
    // Browser converts hex to rgb; assert the computed gradient contains the dusk gradient pattern
    const bgValue = computedStyle.background || computedStyle.backgroundImage
    expect(bgValue).toContain('linear-gradient')
    // Verify dusk gradient is present by checking for the rgb conversion of dusk colors
    expect(bgValue).toContain('rgb(255, 154, 86)') // #ff9a56 in dusk

    // Verify it changes for a different phase
    rerender(<SkyBackdrop phase="day" />)
    const elDay = screen.getByTestId('sky-backdrop')
    const computedStyleDay = window.getComputedStyle(elDay)
    const bgValueDay = computedStyleDay.background || computedStyleDay.backgroundImage
    // Day gradient has different colors; should not contain dusk's rgb values
    expect(bgValueDay).not.toContain('rgb(255, 154, 86)')
    // Day should have its own colors
    expect(bgValueDay).toContain('rgb(135, 206, 235)') // #87ceeb in day
  })

  it('applies mask when fade prop is true, and omits it when false', () => {
    const { rerender } = render(<SkyBackdrop phase="day" fade={false} />)
    const elNoFade = screen.getByTestId('sky-backdrop')
    let computedStyle = window.getComputedStyle(elNoFade)
    expect(computedStyle.maskImage).toBe('none')

    rerender(<SkyBackdrop phase="day" fade={true} />)
    const elFade = screen.getByTestId('sky-backdrop')
    computedStyle = window.getComputedStyle(elFade)
    // maskImage should be set when fade is true
    expect(computedStyle.maskImage).not.toBe('none')
    expect(computedStyle.maskImage).toContain('linear-gradient')
  })

  it('has a gradient for every phase', () => {
    expect(Object.keys(skyGradients).sort()).toEqual(['dawn', 'day', 'dusk', 'night'])
  })
})
