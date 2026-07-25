import { packPages } from './paging'

describe('packPages', () => {
  it('packs items greedily into pages', () => {
    // 3 items of 100 + gaps of 10 into 220 available: [0,1] then [2]
    expect(packPages([100, 100, 100], 220, 10)).toEqual([[0, 1], [2]])
  })

  it('returns one page when everything fits', () => {
    expect(packPages([50, 50], 500, 10)).toEqual([[0, 1]])
  })

  it('gives an oversized item its own page', () => {
    // item 1 is wider than the row — it pans rather than being dropped
    expect(packPages([50, 900, 50], 200, 10)).toEqual([[0], [1], [2]])
  })

  it('handles empty input', () => {
    expect(packPages([], 300, 10)).toEqual([])
  })

  it('falls back to a single page when width is unmeasured', () => {
    expect(packPages([100, 100], 0, 10)).toEqual([[0, 1]])
  })
})
