/** Short Web Audio beep, best-effort. No-ops when Web Audio is unavailable or autoplay-blocked. */
export function playChime(): void {
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
    /* autoplay blocked or Web Audio unavailable — chime is best-effort */
  }
}

let alarmHandle: ReturnType<typeof setInterval> | null = null

/** Repeat a beep every intervalMs until stopAlarm(). Idempotent while running. */
export function startAlarm(intervalMs = 2000, beep: () => void = playChime): void {
  if (alarmHandle !== null) return
  beep()
  alarmHandle = setInterval(beep, intervalMs)
}
export function stopAlarm(): void {
  if (alarmHandle !== null) { clearInterval(alarmHandle); alarmHandle = null }
}
export function isAlarmRunning(): boolean {
  return alarmHandle !== null
}
