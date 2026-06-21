import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SkeletonRow } from './SkeletonRow'

describe('SkeletonRow', () => {
  it('renders a skeleton row with pulse animation', () => {
    const { container } = render(<SkeletonRow />)
    const skeleton = container.querySelector('div')

    expect(skeleton).toBeDefined()
    expect(skeleton?.className).toContain('bg-surface-2')
    expect(skeleton?.className).toContain('border')
    expect(skeleton?.className).toContain('border-border')
    expect(skeleton?.className).toContain('rounded')
    expect(skeleton?.className).toContain('h-12')
    expect(skeleton?.className).toContain('animate-pulse')
    expect(skeleton?.className).toContain('mb-2')
  })
})
