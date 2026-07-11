import type { Deadline, Task, EventItem, Signal, Alert } from '@/api'
import { urgencyOf, type Urgency } from '@/lib/horizon'

export interface ApproachItem {
  key: string; id: number; title: string; when: string
  type: 'deadline' | 'task' | 'event'; seconds: number; urgency: Urgency
}

export interface ResponseItem {
  key: string; kind: 'signal' | 'alert'; id: number
  title: string; detail: string; url?: string; rank: number
}

export const URGENCY_CHIP: Record<Urgency, 'error' | 'warning' | 'info' | 'default'> = {
  critical: 'error', urgent: 'error', soon: 'warning', normal: 'default',
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'now'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const HORIZON = 86400 // 24h window for "approaching"

export function buildApproaching(deadlines: Deadline[], tasks: Task[], events: EventItem[], now: Date): ApproachItem[] {
  const nowMs = now.getTime()
  const secs = (iso: string) => Math.floor((new Date(iso).getTime() - nowMs) / 1000)
  const out: ApproachItem[] = []
  for (const d of deadlines) {
    out.push({ key: `d${d.id}`, id: d.id, title: d.title, when: d.due_at, type: 'deadline', seconds: d.countdown_seconds, urgency: urgencyOf(d.countdown_seconds) })
  }
  for (const t of tasks) {
    if (!t.due_at || t.status === 'done' || t.status === 'dismissed') continue
    const s = secs(t.due_at)
    out.push({ key: `t${t.id}`, id: t.id, title: t.title, when: t.due_at, type: 'task', seconds: s, urgency: urgencyOf(s) })
  }
  for (const e of events) {
    if (!e.chosen_time) continue
    const s = secs(e.chosen_time)
    out.push({ key: `e${e.id}`, id: e.id, title: e.title, when: e.chosen_time, type: 'event', seconds: s, urgency: urgencyOf(s) })
  }
  return out.filter((i) => i.seconds <= HORIZON).sort((a, b) => a.seconds - b.seconds)
}

const alertRank = (severity: string) => severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2

export function buildNeedsResponse(signals: Signal[], alerts: Alert[]): ResponseItem[] {
  const out: ResponseItem[] = []
  for (const s of signals) {
    out.push({
      key: `s${s.id}`, kind: 'signal', id: s.id, title: s.title,
      detail: s.summary || s.what || s.why || '', url: s.url, rank: s.priority ?? 3,
    })
  }
  for (const a of alerts) {
    out.push({ key: `a${a.id}`, kind: 'alert', id: a.id, title: a.title, detail: a.body ?? '', url: a.url, rank: alertRank(a.severity) })
  }
  return out.sort((x, y) => x.rank - y.rank)
}
