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
it('every spec has at least one field and a mode', () => {
  for (const s of Object.values(ACTION_SPECS)) {
    expect(s.fields.length).toBeGreaterThan(0)
    expect(['review', 'auto']).toContain(s.mode)
  }
})
