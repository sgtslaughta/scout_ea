import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAlerts, type Alert } from '@/api'

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

function playChime(): void {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  try {
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    /* autoplay blocked or Web Audio unavailable — chime is best-effort; the notification is guaranteed */
  }
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
