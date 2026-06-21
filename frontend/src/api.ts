/**
 * Typed API fetchers for Scout EA backend endpoints.
 * All responses are JSON as specified in backend/web/app.py.
 */

export interface Deadline {
  id: number
  title: string
  due_at: string
  countdown_seconds: number
  detail?: string
  source: string
  status: string
  visible: number
}

export interface Trend {
  id: number
  term: string
  kind: string
  window_start: string
  window_end: string
  score: number
  delta?: number
  count?: number
  sources?: string
}

export interface Signal {
  id: number
  type: string
  source: string
  source_skill?: string
  title: string
  status: string
  priority: number
  created_at: string
  external_ref?: string
}

export interface Task {
  id: number
  title: string
  due_at?: string
  status: string
  priority: number
}

export interface OutlookResponse {
  date: string
  deadlines: Deadline[]
  top_trends: Trend[]
  proactive: Signal[]
  tasks_due_today: Task[]
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const getOutlook = () => fetchJson<OutlookResponse>('/api/outlook')

export const getDeadlines = () => fetchJson<Deadline[]>('/api/deadlines')

export const getTrends = (windowStart?: string) => {
  const qs = windowStart ? `?window_start=${encodeURIComponent(windowStart)}` : ''
  return fetchJson<Trend[]>(`/api/trends${qs}`)
}

export const getSignals = (status?: string) => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return fetchJson<Signal[]>(`/api/signals${qs}`)
}
