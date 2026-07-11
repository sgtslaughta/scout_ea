/**
 * Pure logic for the horizon bar: map deadlines onto today's 7a-6p clock axis,
 * classify urgency by countdown, and split future deadlines into an overflow
 * bucket. No React, no ambient clock (callers pass `now`).
 */
import type { Deadline } from '@/api'

export type Urgency = 'critical' | 'urgent' | 'soon' | 'normal'

export interface AxisDeadline {
  deadline: Deadline
  percent: number
  urgency: Urgency
}

export interface HorizonBuckets {
  onAxis: AxisDeadline[]
  later: Deadline[]
}

/** Urgency tier from seconds-until-due (<=0 is overdue). */
export function urgencyOf(countdownSeconds: number): Urgency {
  if (countdownSeconds <= 0 || countdownSeconds <= 900) return 'critical'
  if (countdownSeconds <= 7200) return 'urgent'
  if (countdownSeconds <= 86400) return 'soon'
  return 'normal'
}

/** Position of a clock time on the workday axis (default 7a-6p), clamped to 0..100. */
export function clockPercent(date: Date, startHour = 7, endHour = 18): number {
  const startMin = startHour * 60
  const spanMin = Math.max(1, (endHour - startHour) * 60)
  const minutes = date.getHours() * 60 + date.getMinutes()
  const pct = ((minutes - startMin) / spanMin) * 100
  return Math.max(0, Math.min(100, pct))
}

/** True if a datetime falls within the workday hour span [start, end). */
export function inWorkday(date: Date, startHour: number, endHour: number): boolean {
  const h = date.getHours() + date.getMinutes() / 60
  return h >= startHour && h < endHour
}

/** Greedily group items whose percent are within thresholdPct of the cluster anchor. */
export function clusterByProximity<T extends { percent: number }>(
  items: T[], thresholdPct = 4,
): { percent: number; items: T[] }[] {
  const sorted = [...items].sort((a, b) => a.percent - b.percent)
  const clusters: { percent: number; items: T[] }[] = []
  for (const it of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && it.percent - last.percent <= thresholdPct) last.items.push(it)
    else clusters.push({ percent: it.percent, items: [it] })
  }
  return clusters
}

/** True if both dates fall on the same local calendar day. */
export function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

/**
 * Split deadlines into on-axis dots (due today, or overdue) and a later bucket
 * (due on a future day). Overdue deadlines from a past day clamp to 0%.
 */
export function bucketDeadlines(deadlines: Deadline[], now: Date): HorizonBuckets {
  const onAxis: AxisDeadline[] = []
  const later: Deadline[] = []
  for (const d of deadlines) {
    const due = new Date(d.due_at)
    if (isNaN(due.getTime())) continue
    const overdue = d.countdown_seconds <= 0
    if (sameLocalDay(due, now) || overdue) {
      const percent = overdue && !sameLocalDay(due, now) ? 0 : clockPercent(due)
      onAxis.push({ deadline: d, percent, urgency: urgencyOf(d.countdown_seconds) })
    } else {
      later.push(d)
    }
  }
  return { onAxis, later }
}
