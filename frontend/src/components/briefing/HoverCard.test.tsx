import { render, screen } from '@testing-library/react'
import { HoverCard } from './HoverCard'

it('renders children when open', () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  render(<HoverCard anchorEl={anchor} open onClose={() => {}}>hello</HoverCard>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})

it('renders nothing when closed', () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  render(<HoverCard anchorEl={anchor} open={false} onClose={() => {}}>hidden</HoverCard>)
  expect(screen.queryByText('hidden')).not.toBeInTheDocument()
})
