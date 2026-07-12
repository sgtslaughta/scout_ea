import { describe, it, expect } from 'vitest'
import { safeHttpUrl } from './url'

describe('safeHttpUrl', () => {
  it('accepts http and https', () => {
    expect(safeHttpUrl('http://a.com')).toBe('http://a.com/')
    expect(safeHttpUrl('https://a.com/x')).toBe('https://a.com/x')
  })
  it('rejects javascript: and other schemes', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,x')).toBeNull()
    expect(safeHttpUrl(undefined)).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
  })
})
