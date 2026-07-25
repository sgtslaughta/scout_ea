import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CelestialArc } from './CelestialArc'

describe('CelestialArc', () => {
  it('renders the sun when not night', () => {
    render(<CelestialArc arcPos={0.5} isNight={false} />)
    expect(screen.getByTestId('celestial-sun')).toBeInTheDocument()
    expect(screen.queryByTestId('celestial-moon')).not.toBeInTheDocument()
  })

  it('renders the moon at night', () => {
    render(<CelestialArc arcPos={0.5} isNight />)
    expect(screen.getByTestId('celestial-moon')).toBeInTheDocument()
    expect(screen.queryByTestId('celestial-sun')).not.toBeInTheDocument()
  })

  it('does not distort the arc — svg spans without preserveAspectRatio letterboxing', () => {
    const { container } = render(<CelestialArc arcPos={0.5} isNight={false} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('none')
  })

  it('uses a near-square viewBox — a squashed one (e.g. 100x40) reintroduces the flattening bug', () => {
    const { container } = render(<CelestialArc arcPos={0.5} isNight={false} />)
    const svg = container.querySelector('svg')
    const [, , vbWidth, vbHeight] = (svg?.getAttribute('viewBox') || '').split(/\s+/).map(Number)
    expect(vbWidth).toBeGreaterThan(0)
    // A 100x40 viewBox (ratio 0.4) is what caused the original squash; require
    // something close to square so height scaling isn't ~3x weaker than width scaling.
    expect(vbHeight / vbWidth).toBeGreaterThanOrEqual(0.8)
  })

  it('the arc path has a real vertical excursion — a flat line is the visual defect', () => {
    const { container } = render(<CelestialArc arcPos={0.5} isNight={false} />)
    const path = container.querySelector('path')
    const d = path?.getAttribute('d') || ''
    const [, , vbHeight] = (container.querySelector('svg')?.getAttribute('viewBox') || '').split(/\s+/).map(Number)
    // "M <x0> <y0> Q <cx> <cy> <x1> <y1>" — baseline is y0/y1, peak is the Q control point cy.
    const match = d.match(/M\s+[\d.-]+\s+([\d.-]+)\s+Q\s+[\d.-]+\s+([\d.-]+)/)
    expect(match).not.toBeNull()
    const [, baselineY, peakY] = match!.map(Number)
    const excursion = Math.abs(baselineY - peakY)
    // Require the peak to rise at least 30% of the viewBox height above the baseline —
    // a flat/near-flat arc would have excursion near 0.
    expect(excursion / vbHeight).toBeGreaterThan(0.3)
  })
})
