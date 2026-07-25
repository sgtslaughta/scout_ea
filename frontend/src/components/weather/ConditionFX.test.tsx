import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConditionFX } from './ConditionFX'

describe('ConditionFX', () => {
  it('renders a condition effects layer', () => {
    render(<ConditionFX condition="rain" isDay />)
    expect(screen.getByTestId('condition-rain')).toBeInTheDocument()
  })

  it('renders multiple clouds with staggered delays so they do not travel as one block', () => {
    render(<ConditionFX condition="clouds" isDay />)
    const clouds = screen.getAllByTestId('cloud')
    expect(clouds.length).toBeGreaterThan(1)
    const delays = clouds.map((c) => getComputedStyle(c).animationDelay || '0s')
    // Not all identical — staggered.
    expect(new Set(delays).size).toBeGreaterThan(1)
  })

  function findKeyframesStyleTag() {
    return Array.from(document.querySelectorAll('style')).find((s) =>
      s.textContent?.includes('@keyframes driftClouds'),
    )
  }

  it('drifts clouds via left (container-relative), not translateX (element-relative)', () => {
    render(<ConditionFX condition="clouds" isDay />)
    const styleTag = findKeyframesStyleTag()
    expect(styleTag?.textContent).toContain('driftClouds')
    expect(styleTag?.textContent).toMatch(/@keyframes driftClouds\s*{\s*0%\s*{\s*left:/)
  })

  it('disables all animation under prefers-reduced-motion', () => {
    render(<ConditionFX condition="clouds" isDay />)
    const styleTag = findKeyframesStyleTag()
    expect(styleTag?.textContent).toContain('prefers-reduced-motion: reduce')
  })
})
