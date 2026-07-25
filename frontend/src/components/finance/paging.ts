/**
 * Greedily pack item widths into pages that fit `available`.
 * Returns arrays of indices, one per page.
 *
 * An item wider than the row gets its own page rather than being dropped —
 * the row pans it L→R instead.
 */
export function packPages(widths: number[], available: number, gap: number): number[][] {
  if (widths.length === 0) return []
  // Unmeasured (first render, hidden container): show everything on one page.
  if (available <= 0) return [widths.map((_, i) => i)]

  const pages: number[][] = []
  let page: number[] = []
  let used = 0

  for (let i = 0; i < widths.length; i++) {
    const w = widths[i]
    const cost = page.length === 0 ? w : w + gap
    if (page.length > 0 && used + cost > available) {
      pages.push(page)
      page = [i]
      used = w
    } else {
      page.push(i)
      used += cost
    }
  }
  if (page.length > 0) pages.push(page)
  return pages
}
