import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagChips } from './TagChips'

describe('TagChips', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<TagChips />)
    expect(container.firstChild).toBeNull()
  })

  it('renders tag + link labels and fires click handlers', () => {
    const onTagClick = vi.fn()
    const onLinkClick = vi.fn()
    render(
      <TagChips
        tags={[{ tag_id: 1, name: 'urgent', color: 'amber' }]}
        links={[{ id: 2, target_type: 'person', target_id: 3, label: 'Ada' }]}
        onTagClick={onTagClick} onLinkClick={onLinkClick}
      />,
    )
    fireEvent.click(screen.getByText('urgent'))
    fireEvent.click(screen.getByText('Ada'))
    expect(onTagClick).toHaveBeenCalledOnce()
    expect(onLinkClick).toHaveBeenCalledOnce()
  })
})
