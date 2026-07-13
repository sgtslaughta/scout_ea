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
  links?: ContentLink[]
  tags?: ContentTag[]
}

export interface Tag { id: number; name: string; color: string }
export interface ContentTag { tag_id: number; name: string; color: string }
export interface ContentLink { id: number; target_type: string; target_id: number; label: string }
export interface ContentRefs { tags: ContentTag[]; links: ContentLink[] }

export interface NewsItem {
  id: number; title: string; url?: string; synopsis?: string; topic_id?: number
  source?: string; event_at?: string; relevance?: number; status: string
  tags?: ContentTag[]; links?: ContentLink[]
}
export interface LearningItem {
  id: number; kind: string; title: string; synopsis?: string; url?: string; provider?: string
  event_at?: string; topic_id?: number; relevance?: number; status: string
  tags?: ContentTag[]; links?: ContentLink[]
}
export interface FeedRecent {
  category: string; id: number; title: string; when: string; url?: string; status: string
  tags?: ContentTag[]; links?: ContentLink[]
}
export interface FeedOverview { counts: Record<string, number>; recent: FeedRecent[] }
export interface FeedFilters { status?: string; topic?: number; tag?: string; person?: number; origin?: string }

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
  // detail (present from SELECT *; used by Quickdraw expanded rows)
  summary?: string
  who?: string
  what?: string
  when_rel?: string
  why?: string
  reasoning?: string
  url?: string
  person_id?: number
  polarity?: 'risk' | 'opportunity' | null
}

export interface Task {
  id: number
  title: string
  detail?: string
  due_at?: string
  priority: number
  status: string
  board_column_id?: number | null
  created_at?: string
}

export interface BoardColumn {
  id: number
  name: string
  position: number
  /** Task status applied when a card is dropped into this column. */
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

export interface CriticalItem {
  id: number; title: string; kind: 'deadline' | 'task' | 'signal'
  nav: { view: string; id: number }
  countdown_seconds?: number; due_at?: string; priority?: number; summary?: string; why?: string
}
export interface BriefingTopicGroup {
  topic_id: number; topic_name: string; topic_priority: number
  items: (NewsItem | LearningItem)[] & { category: 'news' | 'learning' }[]
}
export interface BriefingPerson extends Person { signals: Signal[] }
export interface BriefingResponse {
  date: string
  summary: string | null
  critical: CriticalItem[]
  risks: Signal[]
  opportunities: Signal[]
  news_by_topic: BriefingTopicGroup[]
  people: BriefingPerson[]
  weather: null
  finance: null
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const getOutlook = () => fetchJson<OutlookResponse>('/api/outlook')

export const getBriefing = () => fetchJson<BriefingResponse>('/api/briefing')

export const getWeather = (lat: number, lon: number) =>
  fetchJson<WeatherResponse>(`/api/weather?lat=${lat}&lon=${lon}`)

export const getFinance = () => fetchJson<FinanceResponse>('/api/finance')

export const getConfig = () => fetchJson<Record<string, string>>('/api/config')

export const getDeadlines = (includeHidden?: boolean) =>
  fetchJson<Deadline[]>(`/api/deadlines${includeHidden ? '?include_hidden=true' : ''}`)

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

export interface Alert {
  id: number
  severity: string
  title: string
  body?: string
  url?: string
  source_table?: string
  source_id?: number
  status: string
  created_at: string
}

export const getAlerts = () => fetchJson<Alert[]>('/api/alerts')

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

export const updateDeadline = (id: number, body: Partial<Deadline>) =>
  patchJson<{ updated: number }>(`/api/deadlines/${id}`, body)

export const setDeadlineVisible = (id: number, visible: boolean) =>
  postJson<{ updated: number }>(`/api/deadlines/${id}/visible`, { visible })

export const setConfig = (key: string, value: string) =>
  postJson<{ key: string; value: string }>(`/api/config/${key}`, { value })

export const getTags = () => fetchJson<Tag[]>('/api/tags')
export const createTag = (name: string, color = 'neutral') =>
  postJson<{ id: number }>('/api/tags', { name, color })
export const getContentRefs = (refType: string, refId: number) =>
  fetchJson<ContentRefs>(`/api/content/${refType}/${refId}/refs`)
export const tagContent = (refType: string, refId: number, name: string, color = 'neutral') =>
  postJson<{ ok: boolean }>(`/api/content/${refType}/${refId}/tags`, { name, color })
export const untagContent = (refType: string, refId: number, tagId: number) =>
  del<{ deleted: number }>(`/api/content/${refType}/${refId}/tags/${tagId}`)
export const linkContent = (refType: string, refId: number, target_type: string, target_id: number) =>
  postJson<{ ok: boolean }>(`/api/content/${refType}/${refId}/links`, { target_type, target_id })
export const unlinkContent = (refType: string, refId: number, linkId: number) =>
  del<{ deleted: number }>(`/api/content/${refType}/${refId}/links/${linkId}`)

const feedQuery = (f?: FeedFilters) => {
  if (!f) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const getFeed = () => fetchJson<FeedOverview>('/api/feed')
export const getNews = (filters?: FeedFilters) => fetchJson<NewsItem[]>(`/api/news${feedQuery(filters)}`)
export const getLearning = (filters?: FeedFilters) => fetchJson<LearningItem[]>(`/api/learning${feedQuery(filters)}`)
export const setNewsStatus = (id: number, status: string) =>
  postJson<{ updated: number }>(`/api/news_items/${id}/status`, { status })
export const setLearningStatus = (id: number, status: string) =>
  postJson<{ updated: number }>(`/api/learning/${id}/status`, { status })

export const setSignalStatus = (table: string, id: number, status: string) =>
  postJson<{ updated: number }>(`/api/${table}/${id}/status`, { status })

export const getTasks = () => fetchJson<Task[]>('/api/tasks')

export const createTask = (body: Partial<Task>) =>
  postJson<{ id: number }>('/api/tasks', body)

export const updateTask = (id: number, body: Partial<Task>) =>
  patchJson<{ updated: number }>(`/api/tasks/${id}`, body)

export const getBoardColumns = () => fetchJson<BoardColumn[]>('/api/board/columns')

export const addBoardColumn = (name: string, status: string = 'open') =>
  postJson<{ id: number }>('/api/board/columns', { name, status })

export const updateBoardColumn = (id: number, body: Partial<Pick<BoardColumn, 'name' | 'position' | 'status'>>) =>
  patchJson<{ updated: number }>(`/api/board/columns/${id}`, body)

export const deleteBoardColumn = (id: number) =>
  del<{ deleted: number }>(`/api/board/columns/${id}`)

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

export interface Action {
  id: number
  entity_type?: string
  entity_id?: number
  action_type: string
  mode: string
  status: string
  payload?: Record<string, unknown>
  rationale?: string
  result?: Record<string, unknown>
  error?: string
  created_at: string
}
export interface Guidance { id: number; scope: string; text: string; created_at: string }

export interface WeatherResponse {
  temp?: number
  code?: number
  condition?: 'clear' | 'clouds' | 'rain' | 'snow' | 'fog' | 'storm'
  is_day?: boolean
  sunrise?: string
  sunset?: string
  label?: string
  stale?: boolean
  error?: string
}

export interface Quote {
  symbol: string
  price?: number
  open?: number; high?: number; low?: number; volume?: number
  change_pct?: number | null
  date?: string; time?: string
}
export interface FinanceResponse {
  watchlist: Quote[]
  indices: Quote[]
  stale?: boolean
  error?: string
}

export interface ActionCreate {
  action_type: string
  entity_type?: string
  entity_id?: number
  mode?: string
  payload?: Record<string, unknown>
  rationale?: string
  approve?: boolean
}

export const listActions = (status?: string) =>
  fetchJson<Action[]>(`/api/actions${status ? `?status=${encodeURIComponent(status)}` : ''}`)
export const createAction = (body: ActionCreate) =>
  postJson<{ id: number }>('/api/actions', body as unknown as Record<string, unknown>)
export const approveAction = (id: number) =>
  postJson<{ updated: number }>(`/api/actions/${id}/approve`, {})
export const dismissAction = (id: number) =>
  postJson<{ updated: number }>(`/api/actions/${id}/dismiss`, {})

export const getGuidance = (scope?: string) =>
  fetchJson<Guidance[]>(`/api/guidance${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`)
export const addGuidance = (scope: string, text: string) =>
  postJson<{ id: number }>('/api/guidance', { scope, text })
export const deleteGuidance = (id: number) =>
  del<{ deleted: number }>(`/api/guidance/${id}`)
