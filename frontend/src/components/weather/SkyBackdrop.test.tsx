import { render } from '@testing-library/react'
import { SkyBackdrop, skyGradients } from './SkyBackdrop'

describe('SkyBackdrop', () => {
  it('paints the gradient for the given phase', () => {
    const { container } = render(<SkyBackdrop phase="dusk" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveStyle({ position: 'absolute' })
    expect(skyGradients.dusk).toContain('linear-gradient')
  })

  it('exposes a gradient for every phase', () => {
    expect(Object.keys(skyGradients).sort()).toEqual(['dawn', 'day', 'dusk', 'night'])
  })
})
