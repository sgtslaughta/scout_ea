import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { resolveTheme, setStoredMode } from '@/lib/theme'

interface SignatureBarProps {
  onCommandOpen?: () => void
  onOpenBriefing?: () => void
}

export function SignatureBar({ onCommandOpen }: SignatureBarProps) {
  const [time, setTime] = useState(new Date())
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setPrefersReducedMotion(mediaQuery.matches)
      // Update resolved theme on mount
      const stored = localStorage.getItem('ea-theme') as any
      setResolvedTheme(resolveTheme(stored) || 'dark')
      // Listen for class changes
      const observer = new MutationObserver(() => {
        const isDark = !document.documentElement.classList.contains('light')
        setResolvedTheme(isDark ? 'dark' : 'light')
      })
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => observer.disconnect()
    }
  }, [])

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
    <div className="relative h-12 flex items-center px-4 bg-surface border-b border-border">
      <span className="font-display text-lg mr-4">SCOUT</span>
      <div className="relative flex-1 h-8">
        {/* horizon line */}
        <motion.div
          data-horizon
          className="absolute left-0 right-0 top-1/2 h-[3px] rounded"
          style={{ background: "linear-gradient(90deg,var(--color-accent),var(--color-accent-2))", originX: 0 }}
          initial={prefersReducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
          animate={prefersReducedMotion ? { scaleX: 1 } : { scaleX: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
        {/* now marker at position */}
        <motion.div
          className="absolute -translate-x-1/2"
          style={{ left: `${positionPercent}%`, top: "calc(50% - 9px)" }}
          animate={prefersReducedMotion ? {} : { opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div style={{
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "10px solid var(--color-accent)",
            filter: "drop-shadow(0 0 4px var(--color-accent))"
          }} />
        </motion.div>
        {/* hour ticks 7a..6p */}
        {[7, 9, 11, 13, 15, 17].map((h) => (
          <div
            key={h}
            className="absolute text-[9px] text-muted font-mono"
            style={{ left: `${(h - 7) / 11 * 100}%`, top: "100%" }}
          >
            {h > 12 ? `${h - 12}p` : `${h}a`}
          </div>
        ))}
      </div>
      <span className="ml-4 text-muted text-xs font-mono">last ran 14:32</span>
      <button
        onClick={() => setStoredMode(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="ml-3 h-5 w-5 text-muted hover:text-accent transition-colors flex-shrink-0"
        title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <button
        onClick={onCommandOpen}
        className="ml-3 text-muted text-xs border border-border rounded px-1.5 py-0.5 hover:border-accent hover:text-accent transition-colors cursor-pointer"
        aria-label="Open command palette"
      >
        ⌘K
      </button>
    </div>
  )
}
