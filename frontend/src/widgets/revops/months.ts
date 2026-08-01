/** 'YYYY-MM' for the given date (local time), defaulting to today. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM' values spanning `span` months on either side of `center`, oldest first. */
export function monthOptions(center: string = currentMonth(), span = 6): string[] {
  const [y, m] = center.split('-').map(Number)
  const out: string[] = []
  for (let offset = -span; offset <= span; offset++) {
    const d = new Date(y, m - 1 + offset, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** Friendly "March 2026" label for a 'YYYY-MM' value. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
