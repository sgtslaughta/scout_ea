import { it, expect } from 'vitest'
import { buildNotificationOptions } from './notificationOptions'

it('loud → requireInteraction + renotify + tag', () => {
  const o = buildNotificationOptions({ body: 'b', loud: true, tag: 'alert-7' }) as Record<string, unknown>
  expect(o.requireInteraction).toBe(true)
  expect(o.renotify).toBe(true)
  expect(o.tag).toBe('alert-7')
  expect(o.body).toBe('b')
})

it('non-loud → no requireInteraction', () => {
  const o = buildNotificationOptions({ body: 'b', loud: false, tag: 'alert-7' }) as Record<string, unknown>
  expect(o.requireInteraction).toBeUndefined()
  expect(o.tag).toBe('alert-7')
})
