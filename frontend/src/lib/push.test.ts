import { describe, it, expect } from 'vitest'
import { pushSupported } from './push'

describe('push module', () => {
  it('imports successfully', () => {
    expect(pushSupported).toBeDefined()
  })

  it('pushSupported() returns a boolean', () => {
    const result = pushSupported()
    expect(typeof result).toBe('boolean')
  })
})
