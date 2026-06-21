import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function SignatureBar() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Calculate position along work hours (7am - 6pm = 11 hours)
  const hour = time.getHours()
  const minutes = time.getMinutes()
  const totalMinutes = hour * 60 + minutes
  const workStart = 7 * 60 // 7am
  const workEnd = 18 * 60 // 6pm
  const workDuration = workEnd - workStart
  const positionPercent = Math.max(0, Math.min(100, ((totalMinutes - workStart) / workDuration) * 100))

  return (
    <div className="bg-surface border-b border-border px-6 py-3">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h1 className="text-2xl font-display font-semibold text-text">
          SCOUT
        </h1>
        <div className="text-xs text-muted font-mono">
          Last ran 14:32
        </div>
        <div className="flex-1" />
        <div className="text-xs text-muted">
          <kbd className="px-2 py-1 bg-surface-2 border border-border rounded text-xs">⌘K</kbd>
        </div>
      </div>

      {/* Day horizon strip (7am - 6pm) */}
      <div className="relative h-8 rounded bg-gradient-to-r from-[#1C2840] via-[#2a3a52] to-[#1C2840] border border-border overflow-hidden">
        {/* Gradient horizon line */}
        <motion.div
          className="absolute inset-x-0 top-4 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          style={{ originX: 0 }}
        />

        {/* Now marker (triangle pointing down) */}
        <motion.div
          className="absolute top-2 w-4 h-4 transform -translate-x-1/2"
          style={{ left: `${positionPercent}%` }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-0 h-0 border-l-2 border-r-2 border-t-4 border-l-transparent border-r-transparent border-t-accent" />
        </motion.div>

        {/* Hour ticks and event markers (simplified) */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 flex items-end justify-center pb-1"
            >
              <div className="w-px h-1 bg-muted opacity-40" />
            </div>
          ))}
        </div>

        {/* Time labels */}
        <div className="absolute inset-0 flex px-2 text-[9px] text-muted font-mono select-none">
          <div className="flex-1 flex items-center">7am</div>
          <div className="flex-1 flex items-center justify-center">12pm</div>
          <div className="flex-1 flex items-center justify-end">6pm</div>
        </div>
      </div>
    </div>
  )
}
