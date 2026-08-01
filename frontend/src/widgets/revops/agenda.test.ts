import { describe, it, expect } from 'vitest'
import { buildAgendaText, buildRecapText } from './agenda'
import type { RevOpsActionItem, RevOpsTopic } from './types'

describe('buildAgendaText', () => {
  it('includes only ticked topics, with speaker when set', () => {
    const topics: RevOpsTopic[] = [
      { id: 't1', title: 'Pipeline review', speaker: 'Jamie', onAgenda: true },
      { id: 't2', title: 'Not on agenda', onAgenda: false },
      { id: 't3', title: 'No speaker', onAgenda: true },
    ]
    const text = buildAgendaText('2026-03', topics)
    expect(text).toContain('Pipeline review (Jamie)')
    expect(text).toContain('- No speaker')
    expect(text).not.toContain('Not on agenda')
  })

  it('says so when nothing is ticked', () => {
    expect(buildAgendaText('2026-03', [])).toContain('No topics on the agenda yet.')
  })
})

describe('buildRecapText', () => {
  it('includes recap notes and action items with owner and done state', () => {
    const items: RevOpsActionItem[] = [
      { id: 'a1', text: 'Follow up with legal', owner: 'Pat', done: true, source: 'user' },
      { id: 'a2', text: 'Send deck', done: false, source: 'scout' },
    ]
    const text = buildRecapText('2026-03', 'Good discussion', items)
    expect(text).toContain('Good discussion')
    expect(text).toContain('[x] Follow up with legal (Pat)')
    expect(text).toContain('[ ] Send deck')
  })

  it('falls back to placeholders when empty', () => {
    const text = buildRecapText('2026-03', undefined, [])
    expect(text).toContain('No recap notes yet.')
    expect(text).toContain('- None')
  })
})
