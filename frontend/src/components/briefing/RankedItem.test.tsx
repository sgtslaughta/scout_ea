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

it('shows full detail when the row is hovered', async () => {
  render(
    <RankedItem rank={1} title="Board deck due" score={92}
      subtitle="short" detail="the full untruncated explanation" meta="due in 4h" />,
  )
  await userEvent.hover(screen.getByText('Board deck due'))
  expect(await screen.findByText(/the full untruncated explanation/)).toBeInTheDocument()
})

it('opens the score explanation on keyboard focus and closes on blur', async () => {
  render(
    <RankedItem rank={1} title="Board deck due" score={92}
      scoreReason="Priority 1 → 92." />,
  )
  await userEvent.tab() // focuses the row
  await userEvent.tab() // focuses the score badge
  const badge = screen.getByRole('button', { name: /Impact score 92 explanation/ })
  expect(badge).toHaveFocus()
  expect(await screen.findByText(/Priority 1 → 92\./)).toBeInTheDocument()
  await userEvent.tab() // moves focus away, blurring the badge
  expect(screen.queryByText(/Priority 1 → 92\./)).not.toBeInTheDocument()
})

it('never shows both the score explanation and the row detail at once', async () => {
  render(
    <RankedItem rank={1} title="Board deck due" score={92}
      scoreReason="Priority 1 → 92." subtitle="short" detail="the full untruncated explanation"
      meta="due in 4h" />,
  )
  // hover the row (not the badge) — row detail shows, score explanation does not
  await userEvent.hover(screen.getByText('Board deck due'))
  expect(await screen.findByText(/the full untruncated explanation/)).toBeInTheDocument()
  expect(screen.queryByText(/Priority 1 → 92\./)).not.toBeInTheDocument()

  // now hover the badge — score explanation shows, row detail no longer does
  await userEvent.hover(screen.getByText('92'))
  expect(await screen.findByText(/Priority 1 → 92\./)).toBeInTheDocument()
  expect(screen.queryByText(/the full untruncated explanation/)).not.toBeInTheDocument()
})
