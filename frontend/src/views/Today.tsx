import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, AlertCircle, Mail, Zap } from 'lucide-react'

// Mock data
const MOCK_SIGNALS = [
  {
    id: '1',
    severity: 'P1' as const,
    title: 'Julie birthday coming up in 3 days',
    source: 'triage_email',
    timestamp: '08:32',
  },
  {
    id: '2',
    severity: 'P2' as const,
    title: 'Q3 roadmap review required by EOD',
    source: 'email',
    timestamp: '07:45',
  },
  {
    id: '3',
    severity: 'P3' as const,
    title: 'New feature request from beta testers',
    source: 'email',
    timestamp: '06:12',
  },
]

const MOCK_PROACTIVE = [
  {
    id: '1',
    title: 'Julie mentioned her anniversary — send a card?',
    action: 'Julie',
  },
]

const SOURCE_BADGE_STYLE = (source: string) => {
  if (source.includes('triage')) {
    // Skill badge - amber tint
    return 'bg-accent/15 text-accent border border-accent/30'
  }
  // Channel badge - muted/neutral
  return 'bg-surface-2 text-muted border border-border'
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  triage_email: <Mail size={12} />,
  email: <Mail size={12} />,
  default: <Zap size={12} />,
}

export function TodayView() {
  const [signals] = useState(MOCK_SIGNALS)
  const [dismissed, setDismissed] = useState(new Set<string>())
  const [proactiveDismissed, setProactiveDismissed] = useState(new Set<string>())
  const today = new Date()

  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' })
  const dateStr = today.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  })

  const visibleSignals = signals.filter((s) => !dismissed.has(s.id))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-6 text-text" style={{ background: '#0B1220' }}
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-display font-semibold mb-2 text-text">
          TODAY — {dayName} {dateStr}
        </h2>
        <div className="text-xs text-muted font-mono">
          Scout last ran 14:32
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-xs">
        <div className="border border-border rounded-lg px-4 py-3" data-card style={{ background: '#131C2B' }}>
          <div className="text-xs text-muted font-mono mb-2 uppercase tracking-wide">Meetings</div>
          <div className="text-xl font-display font-semibold text-text">3</div>
        </div>
        <div className="border border-border rounded-lg px-4 py-3" data-card style={{ background: '#131C2B' }}>
          <div className="text-xs text-muted font-mono mb-2 uppercase tracking-wide">Due Today</div>
          <div className="text-xl font-display font-semibold text-text">2</div>
        </div>
      </div>

      {/* Triaged Signals */}
      <div className="mb-8">
        <h3 className="text-xs font-display font-semibold uppercase tracking-wide mb-4 text-muted">
          Triaged Signals
        </h3>
        <div className="space-y-2 max-w-2xl">
          {visibleSignals.map((signal, idx) => {
            const dotColor = signal.severity === 'P1' ? '#E5484D' : signal.severity === 'P2' ? '#F2A65A' : '#6C8FE5'
            return (
            <motion.div
              key={signal.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 transition-colors group" style={{ background: '#131C2B' }} onMouseEnter={(e) => e.currentTarget.style.background = '#1C2840'} onMouseLeave={(e) => e.currentTarget.style.background = '#131C2B'}
            >
              {/* Severity dot */}
              <div
                data-severity-dot
                style={{ background: dotColor, width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 }}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{signal.title}</div>
                <div className="text-xs text-muted font-mono">
                  {signal.timestamp}
                </div>
              </div>

              {/* Badge - skill vs channel styling */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 flex-shrink-0 transition-colors ${
                  SOURCE_BADGE_STYLE(signal.source)
                }`}
              >
                {SOURCE_ICONS[signal.source] || SOURCE_ICONS.default}
                <span>{signal.source}</span>
              </div>

              {/* Dismiss */}
              <button
                onClick={() =>
                  setDismissed((prev) => new Set([...prev, signal.id]))
                }
                className="w-5 h-5 flex items-center justify-center text-muted group-hover:text-text transition-colors flex-shrink-0"
                aria-label={`Dismiss: ${signal.title}`}
              >
                <X size={14} />
              </button>
            </motion.div>
            )
          })}
        </div>
      </div>

      {/* Proactive Suggestions */}
      {MOCK_PROACTIVE.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-display font-semibold uppercase tracking-wide mb-4 text-muted">
            Proactive
          </h3>
          <div className="space-y-2 max-w-2xl">
            {MOCK_PROACTIVE.map((item) => (
              !proactiveDismissed.has(item.id) && (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="flex items-center gap-4 border border-border rounded-lg px-4 py-3" style={{ background: '#131C2B' }}
                >
                  {/* Icon */}
                  <AlertCircle size={18} className="text-accent flex-shrink-0" />

                  {/* Text */}
                  <div className="flex-1 text-sm font-medium text-text">{item.title}</div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() =>
                        setProactiveDismissed((prev) => new Set([...prev, item.id]))
                      }
                      className="px-3 py-1.5 text-xs font-medium rounded-md hover:opacity-90 transition-colors flex items-center gap-1.5"
                      style={{ background: '#F2A65A', color: '#0B1220' }}
                      aria-label="Accept suggestion"
                    >
                      <Check size={12} />
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        setProactiveDismissed((prev) => new Set([...prev, item.id]))
                      }
                      className="px-3 py-1.5 text-xs font-medium border border-border text-muted rounded-md hover:border-text hover:text-text transition-colors"
                      aria-label="Dismiss suggestion"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-muted font-mono mt-8">
        Ready for your day.
      </div>
    </motion.div>
  )
}
