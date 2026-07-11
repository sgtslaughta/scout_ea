import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders bold, links and lists', () => {
    render(<Markdown>{'**bold** and [link](https://x.com)\n\n- one\n- two'}</Markdown>)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute('href', 'https://x.com')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('does not render raw HTML (XSS-safe)', () => {
    render(<Markdown>{'<img src=x onerror=alert(1)> safe'}</Markdown>)
    // react-markdown escapes raw HTML by default -> no img element
    expect(document.querySelector('img')).toBeNull()
  })
})
