import { it, expect } from 'vitest'
import { actionsForEntity, ACTION_SPECS } from './actions'

it('email entity offers reply/forward/new', () => {
  const types = actionsForEntity('email').map((s) => s.type)
  expect(types).toEqual(expect.arrayContaining(['email_reply', 'email_forward', 'email_new']))
})
it('person entity offers teams + email + invite', () => {
  const types = actionsForEntity('person').map((s) => s.type)
  expect(types).toEqual(expect.arrayContaining(['teams_dm', 'teams_group', 'email_new', 'calendar_invite']))
})
it('every spec has a valid mode', () => {
  for (const s of Object.values(ACTION_SPECS)) {
    expect(['review', 'auto']).toContain(s.mode)
  }
})

it('only field-less actions are ones with nothing to fill in', () => {
  // email_delete needs no input — the target comes from the queued action's
  // external_ref, not from the form. Every other spec must collect something,
  // or its compose modal would be an empty dialog.
  const fieldless = Object.values(ACTION_SPECS).filter((s) => s.fields.length === 0)
  expect(fieldless.map((s) => s.type)).toEqual(['email_delete'])
})

it('mailbox-mutating actions are never auto-approved', () => {
  // These change the user's real mailbox and cannot be undone from this app.
  expect(ACTION_SPECS.email_delete.mode).toBe('review')
  expect(ACTION_SPECS.email_move_folder.mode).toBe('review')
})

it('chat entity offers the teams actions', () => {
  expect(actionsForEntity('chat').map((s) => s.type)).toEqual(
    expect.arrayContaining(['teams_dm', 'teams_group']),
  )
})
