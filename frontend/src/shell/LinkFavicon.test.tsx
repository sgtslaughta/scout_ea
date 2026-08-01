import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LinkFavicon, faviconUrl } from './LinkFavicon'

describe('faviconUrl', () => {
  it('points at the site\'s own favicon, ignoring path and query', () => {
    expect(faviconUrl('https://msx.microsoft.com/pipeline?q=1')).toBe('https://msx.microsoft.com/favicon.ico')
  })

  it('keeps a non-default port, so local dev servers resolve', () => {
    expect(faviconUrl('http://localhost:5174')).toBe('http://localhost:5174/favicon.ico')
  })

  it('returns null for addresses that are not http(s)', () => {
    expect(faviconUrl('javascript:alert(1)')).toBeNull()
    expect(faviconUrl('not a url')).toBeNull()
  })
})

describe('LinkFavicon', () => {
  it('renders the site icon, hidden from screen readers (the link already has a name)', () => {
    const { container } = render(<LinkFavicon url="https://msx.microsoft.com/" />)
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('src', 'https://msx.microsoft.com/favicon.ico')
    expect(img).toHaveAttribute('aria-hidden')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('falls back to a globe when the site has no favicon', () => {
    const { container } = render(<LinkFavicon url="https://no-icon.example/" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('falls back to a globe for an unusable address rather than rendering a broken image', () => {
    const { container } = render(<LinkFavicon url="javascript:alert(1)" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
