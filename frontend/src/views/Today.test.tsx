import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodayView } from './Today'

describe('Today view', () => {
  it('renders TODAY header', () => {
    render(<TodayView />)
    const header = screen.getByRole('heading', { name: /TODAY/i })
    expect(header).toBeDefined()
  })
})
