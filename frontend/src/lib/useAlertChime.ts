import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAlerts, type Alert } from '@/api'
import { playChime } from '@/lib/chime'

function loudSet(threshold: string | undefined): Set<string> {
  if (threshold === 'off') return new Set()
  if (threshold === 'warning') return new Set(['warning', 'critical'])
  return new Set(['critical'])
}

/** Pure decision: given the last-seen max id, the current alerts, and config, should we chime? */
export function shouldChime(
  seen: number | null,
  alerts: Alert[],
  cfg: Record<string, string>,
): { chime: boolean; seen: number } {
  const maxId = alerts.reduce((m, a) => Math.max(m, a.id), 0)
  if (seen === null) return { chime: false, seen: maxId }        // first load: prime, never chime
  if (maxId <= seen) return { chime: false, seen }
  if (cfg.alert_sound_enabled === '0') return { chime: false, seen: maxId }
  const loud = loudSet(cfg.alert_loud_threshold)
  const fresh = alerts.filter((a) => a.id > seen)
  const chime = fresh.some((a) => a.status === 'unread' && loud.has(a.severity))
  return { chime, seen: maxId }
}

/** Foreground-only chime on new unread loud alerts. Renders nothing. Mount once inside the app. */
export function useAlertChime(): void {
  const alertsQ = useQuery({ queryKey: ['alerts'], queryFn: getAlerts, refetchInterval: 15000 })
  const cfgQ = useQuery({ queryKey: ['config'], queryFn: () => fetch('/api/config').then((r) => r.json()) })
  const seen = useRef<number | null>(null)

  useEffect(() => {
    if (!alertsQ.data) return
    const { chime, seen: next } = shouldChime(seen.current, alertsQ.data, cfgQ.data || {})
    seen.current = next
    if (chime) playChime()
  }, [alertsQ.data, cfgQ.data])
}
