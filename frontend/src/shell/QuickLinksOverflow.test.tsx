import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickLinksOverflow } from './QuickLinksOverflow'

const links = [
  { name: 'Alpha', url: 'https://alpha.example' },
  { name: 'Beta', url: 'https://beta.example' },
  { name: 'Gamma', url: 'https://gamma.example' },
]

describe('QuickLinksOverflow', () => {
  it('renders nothing when there are no overflow links', () => {
    render(<QuickLinksOverflow links={[]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows a "+N more" chip for the overflowed links', () => {
    render(<QuickLinksOverflow links={links} />)
    expect(screen.getByRole('button', { name: /\+3 more/i })).toBeInTheDocument()
  })

  it('opens the popover listing all overflowed links on click', async () => {
    render(<QuickLinksOverflow links={links} />)
    await userEvent.click(screen.getByRole('button', { name: /\+3 more/i }))
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument())
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })
})
