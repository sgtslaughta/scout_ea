// src/api.actions.test.ts
import { it, expect, vi, afterEach } from 'vitest'
import { createAction, listActions } from './api'

afterEach(() => vi.restoreAllMocks())

it('createAction POSTs to /api/actions with body', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 5 }) })
  vi.stubGlobal('fetch', fetchMock)
  const r = await createAction({ action_type: 'email_new', payload: { to: 'a@b.com' } })
  expect(r.id).toBe(5)
  expect(fetchMock).toHaveBeenCalledWith('/api/actions', expect.objectContaining({ method: 'POST' }))
})

it('listActions builds status query', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  vi.stubGlobal('fetch', fetchMock)
  await listActions('drafted')
  expect(fetchMock).toHaveBeenCalledWith('/api/actions?status=drafted')
})
