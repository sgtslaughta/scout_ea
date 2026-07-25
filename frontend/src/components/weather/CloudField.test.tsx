import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CloudField } from './CloudField'

function geometrySnapshot() {
  return screen.getAllByTestId('cloud').map((el) => {
    const cs = getComputedStyle(el)
    return `${cs.top}|${cs.transform}|${cs.animationDuration}|${cs.animationDelay}`
  })
}

describe('CloudField', () => {
  it('renders the requested number of clusters, each as one animated container', () => {
    render(<CloudField count={6} />)
    expect(screen.getAllByTestId('cloud')).toHaveLength(6)
  })

  it('produces identical geometry across independent renders (no Math.random jumping)', () => {
    render(<CloudField count={6} />)
    const first = geometrySnapshot()
    cleanup()
    render(<CloudField count={6} />)
    const second = geometrySnapshot()
    expect(second).toEqual(first)
  })

  it('varies cluster shape/position between instances (not identical lozenges)', () => {
    render(<CloudField count={6} />)
    const styles = geometrySnapshot()
    expect(new Set(styles).size).toBeGreaterThan(1)
  })
})
