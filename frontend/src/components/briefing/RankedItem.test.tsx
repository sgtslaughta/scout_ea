import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RankedItem } from './RankedItem'

it('explains the impact score on hover', async () => {
  render(
    <RankedItem rank={1} title="Board deck due" score={92}
      scoreReason="Priority 1 → 92." />,
  )
  await userEvent.hover(screen.getByText('92'))
  expect(await screen.findByText(/Priority 1 → 92\./)).toBeInTheDocument()
  // band legend accompanies the per-item reason
  expect(screen.getByText(/Critical/)).toBeInTheDocument()
})
