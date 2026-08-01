import type { RevOpsActionItem, RevOpsTopic } from './types'

/** Plain-text agenda from ticked topics only, in list order, with speakers when set. */
export function buildAgendaText(month: string, topics: RevOpsTopic[]): string {
  const onAgenda = topics.filter((t) => t.onAgenda)
  const lines = [`RevOps meeting agenda — ${month}`, '']
  if (onAgenda.length === 0) {
    lines.push('No topics on the agenda yet.')
  } else {
    for (const t of onAgenda) lines.push(t.speaker ? `- ${t.title} (${t.speaker})` : `- ${t.title}`)
  }
  return lines.join('\n')
}

/** Paste-friendly recap text for GRACE: recap notes + action items. */
export function buildRecapText(month: string, recapText: string | undefined, actionItems: RevOpsActionItem[]): string {
  const lines = [`RevOps meeting recap — ${month}`, '', recapText?.trim() || 'No recap notes yet.', '', 'Action items:']
  if (actionItems.length === 0) {
    lines.push('- None')
  } else {
    for (const a of actionItems) lines.push(`- [${a.done ? 'x' : ' '}] ${a.text}${a.owner ? ` (${a.owner})` : ''}`)
  }
  return lines.join('\n')
}
