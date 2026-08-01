import type { RecordItem } from '@/api'

export interface RevOpsTopic {
  id: string
  title: string
  speaker?: string
  /** provenance of `speaker` when Scout supplied it, e.g. "from MSX" — cleared once the user overwrites it */
  speakerSource?: string
  onAgenda: boolean
}

export interface RevOpsActionItem {
  id: string
  text: string
  owner?: string
  done: boolean
  source: 'scout' | 'user'
  /** set once a task has been created from this item, so "add to my to-do" can't duplicate it */
  taskAdded?: boolean
}

export interface RevOpsData {
  month: string
  meetingAt: string | null
  meetingSource: 'calendar' | 'manual'
  topics: RevOpsTopic[]
  actionItems: RevOpsActionItem[]
  recapText?: string
  graceUrl?: string
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const bool = (v: unknown): boolean => v === true

function parseTopic(raw: unknown): RevOpsTopic | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  const title = str(r.title)
  if (!id || !title) return null
  return { id, title, speaker: str(r.speaker), speakerSource: str(r.speakerSource), onAgenda: bool(r.onAgenda) }
}

function parseActionItem(raw: unknown): RevOpsActionItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  const text = str(r.text)
  if (!id || !text) return null
  return {
    id,
    text,
    owner: str(r.owner),
    done: bool(r.done),
    source: r.source === 'scout' ? 'scout' : 'user',
    taskAdded: bool(r.taskAdded),
  }
}

export function emptyRevOpsData(month: string): RevOpsData {
  return { month, meetingAt: null, meetingSource: 'manual', topics: [], actionItems: [] }
}

/**
 * Validates+narrows a stored revops_meeting record's data blob into a
 * RevOpsData, or an empty month if the record is missing or malformed — a
 * bad blob must render as an empty editable month, never crash the tile.
 */
export function parseRevOpsRecord(record: RecordItem | undefined, month: string): RevOpsData {
  if (!record || !record.data || typeof record.data !== 'object') return emptyRevOpsData(month)
  const d = record.data as Record<string, unknown>
  const topics = Array.isArray(d.topics)
    ? d.topics.map(parseTopic).filter((t): t is RevOpsTopic => t !== null)
    : []
  const actionItems = Array.isArray(d.actionItems)
    ? d.actionItems.map(parseActionItem).filter((a): a is RevOpsActionItem => a !== null)
    : []
  return {
    month,
    meetingAt: str(d.meetingAt) ?? null,
    meetingSource: d.meetingSource === 'calendar' ? 'calendar' : 'manual',
    topics,
    actionItems,
    recapText: str(d.recapText),
    graceUrl: str(d.graceUrl),
  }
}

/** Full data blob to write back — every save spreads through the whole RevOpsData so no field is ever dropped. */
export function toDataBlob(data: RevOpsData): Record<string, unknown> {
  return {
    month: data.month,
    meetingAt: data.meetingAt,
    meetingSource: data.meetingSource,
    topics: data.topics,
    actionItems: data.actionItems,
    ...(data.recapText ? { recapText: data.recapText } : {}),
    ...(data.graceUrl ? { graceUrl: data.graceUrl } : {}),
  }
}
