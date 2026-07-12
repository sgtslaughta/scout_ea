export type EntityType = 'email' | 'signal' | 'news' | 'person' | 'task' | 'deadline'
export interface ActionField { key: string; label: string; type: 'text' | 'textarea'; required?: boolean }
export interface ActionSpec { type: string; label: string; mode: 'review' | 'auto'; fields: ActionField[] }

const emailFields: ActionField[] = [
  { key: 'to', label: 'To', type: 'text', required: true },
  { key: 'subject', label: 'Subject', type: 'text', required: true },
  { key: 'body', label: 'Body', type: 'textarea', required: true },
]
const teamsFields: ActionField[] = [
  { key: 'recipients', label: 'Recipients (comma-sep)', type: 'text', required: true },
  { key: 'message', label: 'Message', type: 'textarea', required: true },
]

export const ACTION_SPECS: Record<string, ActionSpec> = {
  email_reply: { type: 'email_reply', label: 'Reply', mode: 'review', fields: emailFields },
  email_forward: { type: 'email_forward', label: 'Forward', mode: 'review', fields: emailFields },
  email_new: { type: 'email_new', label: 'Email', mode: 'review', fields: emailFields },
  teams_dm: { type: 'teams_dm', label: 'Teams DM', mode: 'review', fields: teamsFields },
  teams_group: { type: 'teams_group', label: 'Group chat', mode: 'review', fields: teamsFields },
  teams_post: { type: 'teams_post', label: 'Teams post', mode: 'review', fields: teamsFields },
  status_set: { type: 'status_set', label: 'Set status', mode: 'auto',
    fields: [{ key: 'text', label: 'Status', type: 'text', required: true }] },
  calendar_invite: { type: 'calendar_invite', label: 'Calendar invite', mode: 'review',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'attendees', label: 'Attendees (comma-sep)', type: 'text', required: true },
      { key: 'body', label: 'Notes', type: 'textarea' },
    ] },
  cowork_doc: { type: 'cowork_doc', label: 'Draft a doc', mode: 'auto',
    fields: [{ key: 'prompt', label: 'What to draft', type: 'textarea', required: true }] },
  cowork_gather: { type: 'cowork_gather', label: 'Gather info', mode: 'auto',
    fields: [{ key: 'prompt', label: 'What to look up', type: 'textarea', required: true }] },
}

const ENTITY_ACTIONS: Record<EntityType, string[]> = {
  email: ['email_reply', 'email_forward', 'email_new'],
  signal: ['email_new', 'teams_post', 'cowork_gather'],
  news: ['email_new', 'teams_post', 'cowork_gather'],
  person: ['teams_dm', 'teams_group', 'email_new', 'calendar_invite'],
  task: ['email_new', 'cowork_doc'],
  deadline: ['email_new', 'teams_dm'],
}

export function actionsForEntity(entity: EntityType): ActionSpec[] {
  return (ENTITY_ACTIONS[entity] ?? []).map((t) => ACTION_SPECS[t])
}
