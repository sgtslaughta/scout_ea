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
})
