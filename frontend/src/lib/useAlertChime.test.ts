import { it, expect } from 'vitest'
import { shouldChime } from './useAlertChime'
import type { Alert } from '@/api'

const mk = (id: number, severity: string, status = 'unread'): Alert =>
  ({ id, severity, status, title: 't', created_at: '' } as Alert)

it('primes on first load without chiming', () => {
  const r = shouldChime(null, [mk(1, 'critical'), mk(3, 'critical')], {})
  expect(r).toEqual({ chime: false, seen: 3 })
})

it('chimes on a new unread critical (default threshold)', () => {
  const r = shouldChime(3, [mk(3, 'critical'), mk(5, 'critical')], {})
  expect(r).toEqual({ chime: true, seen: 5 })
})

it('does not chime when sound disabled', () => {
  const r = shouldChime(3, [mk(5, 'critical')], { alert_sound_enabled: '0' })
  expect(r.chime).toBe(false)
})

it('does not chime for below-threshold severity', () => {
  const r = shouldChime(3, [mk(5, 'warning')], { alert_loud_threshold: 'critical' })
  expect(r.chime).toBe(false)
})

it('chimes for warning when threshold=warning', () => {
  const r = shouldChime(3, [mk(5, 'warning')], { alert_loud_threshold: 'warning' })
  expect(r.chime).toBe(true)
})

it('does not chime for an already-read new alert', () => {
  const r = shouldChime(3, [mk(5, 'critical', 'read')], {})
  expect(r.chime).toBe(false)
})

it('does not chime when nothing new', () => {
  const r = shouldChime(5, [mk(5, 'critical')], {})
  expect(r).toEqual({ chime: false, seen: 5 })
})
