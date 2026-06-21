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

const SEVERITY_COLORS = {
  P1: { dot: 'bg-crit', badge: 'bg-crit/20 text-crit' },
  P2: { dot: 'bg-warn', badge: 'bg-warn/20 text-warn' },
  P3: { dot: 'bg-info', badge: 'bg-info/20 text-info' },
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
      className="p-6 bg-bg text-text"
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold mb-2">
          TODAY — {dayName} {dateStr}
        </h2>
        <div className="text-xs text-muted font-mono">
          Scout last ran 14:32
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-xs">
        <div className="bg-surface border border-border rounded px-4 py-2">
          <div className="text-xs text-muted font-mono mb-1">Meetings</div>
          <div className="text-lg font-display font-semibold">3</div>
        </div>
        <div className="bg-surface border border-border rounded px-4 py-2">
          <div className="text-xs text-muted font-mono mb-1">Due Today</div>
          <div className="text-lg font-display font-semibold">2</div>
        </div>
      </div>

      {/* Triaged Signals */}
      <div className="mb-8">
        <h3 className="text-xs font-display font-semibold uppercase tracking-wide mb-3 text-muted">
          Triaged Signals
        </h3>
        <div className="space-y-2 max-w-xl">
          {visibleSignals.map((signal, idx) => (
            <motion.div
              key={signal.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="flex items-center gap-3 bg-surface border border-border rounded px-3 py-2 hover:bg-surface-2 transition-colors"
            >
              {/* Severity dot */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  SEVERITY_COLORS[signal.severity].dot
                }`}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">{signal.title}</div>
                <div className="text-xs text-muted font-mono">
                  {signal.timestamp}
                </div>
              </div>

              {/* Badge */}
              <div
                className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 flex-shrink-0 ${
                  SEVERITY_COLORS[signal.severity].badge
                }`}
              >
                {SOURCE_ICONS[signal.source] || SOURCE_ICONS.default}
                {signal.source}
              </div>

              {/* Dismiss */}
              <button
                onClick={() =>
                  setDismissed((prev) => new Set([...prev, signal.id]))
                }
                className="w-5 h-5 flex items-center justify-center text-muted hover:text-text transition-colors flex-shrink-0"
                aria-label={`Dismiss: ${signal.title}`}
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Proactive Suggestions */}
      {MOCK_PROACTIVE.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-display font-semibold uppercase tracking-wide mb-3 text-muted">
            Proactive
          </h3>
          <div className="space-y-2 max-w-xl">
            {MOCK_PROACTIVE.map((item) => (
              !proactiveDismissed.has(item.id) && (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="flex items-center gap-3 bg-surface border border-border rounded px-3 py-2"
                >
                  {/* Icon */}
                  <AlertCircle size={16} className="text-accent flex-shrink-0" />

                  {/* Text */}
                  <div className="flex-1 text-sm text-text">{item.title}</div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() =>
                        setProactiveDismissed((prev) => new Set([...prev, item.id]))
                      }
                      className="px-2 py-1 text-xs bg-accent text-bg rounded hover:bg-accent/90 transition-colors flex items-center gap-1"
                      aria-label="Accept suggestion"
                    >
                      <Check size={12} />
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        setProactiveDismissed((prev) => new Set([...prev, item.id]))
                      }
                      className="px-2 py-1 text-xs border border-border text-muted rounded hover:border-text transition-colors"
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
