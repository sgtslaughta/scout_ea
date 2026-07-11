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
  detail?: string
  due_at?: string
  priority: number
  status: string
}

export interface Skill {
  name: string
  description: string
  schedule?: string
  body: string
  /** ISO timestamp of the most recent skill_run, or null if never run. */
  last_run?: string | null
  /** True when the skill has run recently enough for its cadence. */
  active?: boolean
}

export interface Activity {
  id: number
  skill: string
  ran_at: string
  items_created: number
  status: string
  note?: string
}

export interface EventItem {
  id: number
  title: string
  body?: string
  proposed_times?: string
  chosen_time?: string
  attendees?: string
  status: string
}

export interface Person {
  id: number
  name: string
  role?: string
  org?: string
  importance: number
  notes?: string
  active: number
}

export interface Topic {
  id: number
  name: string
  description?: string
  priority: number
  max_suggest: number
  active: number
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

export const getTrends = async (windowStart?: string): Promise<Trend[]> => {
  const qs = windowStart ? `?window_start=${encodeURIComponent(windowStart)}` : ''
  const rows = await fetchJson<Trend[]>(`/api/trends${qs}`)
  return rows.map((r) => ({
    ...r,
    delta: r.delta == null ? undefined : Number(r.delta),
  }))
}

export const getSkills = () => fetchJson<Skill[]>('/api/skills')

export const getSignals = (status?: string) => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return fetchJson<Signal[]>(`/api/signals${qs}`)
}

export const getActivity = (limit: number = 20) =>
  fetchJson<Activity[]>(`/api/activity?limit=${limit}`)

export interface SearchResult {
  kind: string
  ref_id: number
  title: string
  snippet: string
}

export const search = (q: string) =>
  fetchJson<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`)

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function patchJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const addDeadline = (title: string, due_at: string, detail?: string) =>
  postJson<{ id: number }>('/api/deadlines', { title, due_at, detail })

export const setDeadlineVisible = (id: number, visible: boolean) =>
  postJson<{ updated: number }>(`/api/deadlines/${id}/visible`, { visible })

export const setConfig = (key: string, value: string) =>
  postJson<{ key: string; value: string }>(`/api/config/${key}`, { value })

export const setSignalStatus = (table: string, id: number, status: string) =>
  postJson<{ updated: number }>(`/api/${table}/${id}/status`, { status })

export const getTasks = () => fetchJson<Task[]>('/api/tasks')

export const updateTask = (id: number, body: Partial<Task>) =>
  patchJson<{ updated: number }>(`/api/tasks/${id}`, body)

export const getEvents = () => fetchJson<EventItem[]>('/api/events')

export const getPeople = (includeInactive?: boolean) => {
  const qs = includeInactive ? '?include_inactive=true' : ''
  return fetchJson<Person[]>(`/api/people${qs}`)
}

export const addPerson = (body: Partial<Person>) =>
  postJson<{ id: number }>('/api/people', body)

export const updatePerson = (id: number, body: Partial<Person>) =>
  patchJson<{ updated: number }>(`/api/people/${id}`, body)

export const deletePerson = (id: number) =>
  del<{ deactivated: number }>(`/api/people/${id}`)

export const getTopics = (includeInactive?: boolean) => {
  const qs = includeInactive ? '?include_inactive=true' : ''
  return fetchJson<Topic[]>(`/api/topics${qs}`)
}

export const addTopic = (body: Partial<Topic>) =>
  postJson<{ id: number }>('/api/topics', body)

export const updateTopic = (id: number, body: Partial<Topic>) =>
  patchJson<{ updated: number }>(`/api/topics/${id}`, body)

export const deleteTopic = (id: number) =>
  del<{ deactivated: number }>(`/api/topics/${id}`)
