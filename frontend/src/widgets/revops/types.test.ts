import { describe, it, expect } from 'vitest'
import type { RecordItem } from '@/api'
import { parseRevOpsRecord, emptyRevOpsData, toDataBlob } from './types'

function makeRecord(data: unknown): RecordItem {
  return {
    id: 1, kind: 'revops_meeting', external_ref: 'revops:2026-03', status: 'active', sort: 0,
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
    data: data as Record<string, unknown>,
  }
}

describe('parseRevOpsRecord', () => {
  it('returns an empty editable month when no record exists', () => {
    expect(parseRevOpsRecord(undefined, '2026-03')).toEqual(emptyRevOpsData('2026-03'))
  })

  it('returns an empty editable month for a malformed data blob, never throws', () => {
    expect(parseRevOpsRecord(makeRecord(null), '2026-03')).toEqual(emptyRevOpsData('2026-03'))
    expect(parseRevOpsRecord(makeRecord('garbage'), '2026-03')).toEqual(emptyRevOpsData('2026-03'))
    expect(parseRevOpsRecord(makeRecord({ topics: 'not-an-array' }), '2026-03').topics).toEqual([])
  })

  it('parses a well-formed record and skips malformed topics/action items', () => {
    const record = makeRecord({
      meetingAt: '2026-03-12T10:00:00Z',
      meetingSource: 'calendar',
      topics: [
        { id: 't1', title: 'Pipeline review', speaker: 'Jamie', speakerSource: 'MSX', onAgenda: true },
        { id: 't2' }, // missing title -> dropped
        { title: 'missing id' }, // missing id -> dropped
      ],
      actionItems: [
        { id: 'a1', text: 'Follow up with legal', owner: 'Pat', done: false, source: 'user' },
        { missingText: true },
      ],
      recapText: 'Great meeting',
      graceUrl: 'https://grace.example/notes/1',
    })
    const parsed = parseRevOpsRecord(record, '2026-03')
    expect(parsed.meetingAt).toBe('2026-03-12T10:00:00Z')
    expect(parsed.meetingSource).toBe('calendar')
    expect(parsed.topics).toEqual([
      { id: 't1', title: 'Pipeline review', speaker: 'Jamie', speakerSource: 'MSX', onAgenda: true },
    ])
    expect(parsed.actionItems).toEqual([
      { id: 'a1', text: 'Follow up with legal', owner: 'Pat', done: false, source: 'user', taskAdded: false },
    ])
    expect(parsed.recapText).toBe('Great meeting')
    expect(parsed.graceUrl).toBe('https://grace.example/notes/1')
  })
})

describe('toDataBlob', () => {
  it('round-trips through parseRevOpsRecord without dropping fields', () => {
    const data = {
      month: '2026-03',
      meetingAt: '2026-03-12T10:00:00Z',
      meetingSource: 'calendar' as const,
      topics: [{ id: 't1', title: 'Pipeline review', onAgenda: true }],
      actionItems: [{ id: 'a1', text: 'Follow up', done: false, source: 'user' as const }],
      recapText: 'notes',
      graceUrl: 'https://grace.example',
    }
    const blob = toDataBlob(data)
    const record = { id: 1, kind: 'revops_meeting', external_ref: 'revops:2026-03', status: 'active', sort: 0, created_at: '', updated_at: '', data: blob }
    const reparsed = parseRevOpsRecord(record, '2026-03')
    expect(reparsed.topics).toEqual(data.topics.map((t) => ({ speaker: undefined, speakerSource: undefined, ...t })))
    expect(reparsed.actionItems).toEqual(data.actionItems.map((a) => ({ owner: undefined, taskAdded: false, ...a })))
    expect(reparsed.recapText).toBe('notes')
    expect(reparsed.graceUrl).toBe('https://grace.example')
  })
})
