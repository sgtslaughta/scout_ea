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
    <div className="bg-surface border-b border-border px-6 py-4">
      <div className="flex items-center justify-between gap-4 mb-4">
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

      {/* Day horizon strip (7am - 6pm) - SIGNATURE ELEMENT */}
      <div className="relative h-12 rounded-md bg-gradient-to-r from-[#1C2840] via-[#2a3a52] to-[#1C2840] border border-accent/40 overflow-hidden shadow-lg">
        {/* Gradient horizon line - amber to indigo, more prominent */}
        <motion.div
          className="absolute inset-x-0 top-5 h-1 bg-gradient-to-r from-transparent via-[#F2A65A] to-transparent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          style={{ originX: 0 }}
        />

        {/* Now marker (triangle pointing down) with glow */}
        <motion.div
          className="absolute top-0.5 w-5 h-6 transform -translate-x-1/2"
          style={{ left: `${positionPercent}%` }}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-0 h-0 border-l-2.5 border-r-2.5 border-t-6 border-l-transparent border-r-transparent border-t-[#F2A65A] drop-shadow-lg filter drop-shadow-[0_0_4px_rgba(242,166,90,0.6)]" />
        </motion.div>

        {/* Hour ticks */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 flex items-end justify-center pb-2"
            >
              <div className="w-px h-2 bg-accent opacity-60" />
            </div>
          ))}
        </div>

        {/* Time labels */}
        <div className="absolute inset-0 flex px-3 text-[11px] text-text font-mono select-none font-medium items-center">
          <div className="flex-1">7am</div>
          <div className="flex-1 text-center">12pm</div>
          <div className="flex-1 text-right">6pm</div>
        </div>
      </div>
    </div>
  )
}
