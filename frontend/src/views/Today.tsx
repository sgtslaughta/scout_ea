import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, X, AlertCircle, Mail, Zap } from 'lucide-react'
import { getOutlook, getSignals, setSignalStatus } from '@/api'
import { toast } from 'sonner'

const SOURCE_BADGE_STYLE = (source: string) => {
  if (source.includes('triage')) {
    return 'bg-accent/15 text-accent border border-accent/30'
  }
  return 'bg-surface-2 text-muted border border-border'
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  triage_email: <Mail size={12} />,
  email: <Mail size={12} />,
  default: <Zap size={12} />,
}

const severityFromPriority = (priority: number): 'P1' | 'P2' | 'P3' => {
  if (priority <= 1) return 'P1'
  if (priority === 2) return 'P2'
  return 'P3'
}

export function TodayView() {
  const queryClient = useQueryClient()
  const { data: outlook, isLoading: outlookLoading, error: outlookError } = useQuery({
    queryKey: ['outlook'],
    queryFn: getOutlook,
  })

  const { data: triageSignals = [], isLoading: signalsLoading } = useQuery({
    queryKey: ['signals', 'new'],
    queryFn: () => getSignals('new'),
    enabled: !outlookLoading,
  })

  const [dismissed, setDismissed] = useState(new Set<string>())
  const [proactiveDismissed, setProactiveDismissed] = useState(new Set<string>())

  const dismissMutation = useMutation({
    mutationFn: (id: number) => setSignalStatus('signals', id, 'dismissed'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signals'] }),
  })

  const acceptMutation = useMutation({
    mutationFn: (id: number) => setSignalStatus('signals', id, 'actioned'),
    onSuccess: () => {
      toast.success('Suggestion accepted')
      queryClient.invalidateQueries({ queryKey: ['outlook'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) => setSignalStatus('signals', id, 'dismissed'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outlook'] }),
  })

  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' })
  const dateStr = today.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  })

  // Filter out proactive signals from triaged list
  const regularSignals = triageSignals.filter((s) => s.type !== 'proactive' && !dismissed.has(String(s.id)))
  const proactiveSignals = outlook?.proactive || []
  const visibleProactive = proactiveSignals.filter((p) => !proactiveDismissed.has(String(p.id)))

  if (outlookError) {
    return (
      <main className="flex-1 overflow-y-auto p-6" style={{ background: '#0B1220' }}>
        <div className="max-w-[1080px] mx-auto">
          <div className="text-red-500 text-sm">
            Error loading dashboard: {String(outlookError)}
          </div>
        </div>
      </main>
    )
  }

  const metricsLoading = outlookLoading
  const signalsEmpty = !signalsLoading && regularSignals.length === 0
  const proactiveEmpty = visibleProactive.length === 0
  const tasksToday = outlook?.tasks_due_today || []

  return (
    <main className="flex-1 overflow-y-auto p-6" style={{ background: '#0B1220' }}>
      <div className="max-w-[1080px] mx-auto flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-display font-semibold mb-2 text-text">
              TODAY — {dayName} {dateStr}
            </h2>
            <div className="text-xs text-muted font-mono">
              {metricsLoading ? 'Loading…' : 'Scout last ran now'}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted mb-3">Meetings</div>
              <div className="text-2xl font-display font-semibold text-text">
                {metricsLoading ? '—' : outlook?.deadlines.length || 0}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted mb-3">Due Today</div>
              <div className="text-2xl font-display font-semibold text-text">
                {metricsLoading ? '—' : tasksToday.length}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Triaged Signals Card */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-muted mb-3">
            Triaged Signals
          </h3>
          {signalsLoading ? (
            <div className="text-xs text-muted py-4">Loading signals…</div>
          ) : signalsEmpty ? (
            <div className="text-xs text-muted py-4">No signals to review.</div>
          ) : (
            <div className="space-y-0">
              {regularSignals.map((signal, idx) => {
                const severity = severityFromPriority(signal.priority)
                const dotColor = severity === 'P1' ? '#E5484D' : severity === 'P2' ? '#F2A65A' : '#6C8FE5'
                const isLast = idx === regularSignals.length - 1
                const created = new Date(signal.created_at)
                const timestamp = created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                return (
                  <motion.div
                    key={signal.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className={`flex items-center gap-3 py-2.5 group transition-colors ${!isLast ? 'border-b border-border/60' : ''}`}
                  >
                    <div
                      data-severity-dot
                      style={{ background: dotColor, width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">{signal.title}</div>
                      <div className="text-xs text-muted font-mono">{timestamp}</div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 flex-shrink-0 transition-colors ${
                        SOURCE_BADGE_STYLE(signal.source)
                      }`}
                    >
                      {SOURCE_ICONS[signal.source] || SOURCE_ICONS.default}
                      <span>{signal.source}</span>
                    </div>
                    <button
                      onClick={() => {
                        setDismissed((prev) => new Set([...prev, String(signal.id)]))
                        dismissMutation.mutate(signal.id)
                      }}
                      className="w-5 h-5 flex items-center justify-center text-muted group-hover:text-text transition-colors flex-shrink-0"
                      aria-label={`Dismiss: ${signal.title}`}
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Proactive Suggestions Card */}
        {!proactiveEmpty && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-muted mb-3">Proactive</h3>
            <div className="space-y-0">
              {visibleProactive.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="flex items-center gap-4 py-2.5"
                >
                  <AlertCircle size={18} className="text-accent flex-shrink-0" />
                  <div className="flex-1 text-sm font-medium text-text">{item.title}</div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setProactiveDismissed((prev) => new Set([...prev, String(item.id)]))
                        acceptMutation.mutate(item.id)
                      }}
                      disabled={acceptMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium rounded-md hover:opacity-90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      style={{ background: '#F2A65A', color: '#0B1220' }}
                      aria-label="Accept suggestion"
                    >
                      <Check size={12} />
                      Accept
                    </button>
                    <button
                      onClick={() => {
                        setProactiveDismissed((prev) => new Set([...prev, String(item.id)]))
                        rejectMutation.mutate(item.id)
                      }}
                      disabled={rejectMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium border border-border text-muted rounded-md hover:border-text hover:text-text transition-colors disabled:opacity-50"
                      aria-label="Dismiss suggestion"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted font-mono mt-8">
          Ready for your day.
        </div>
      </div>
    </main>
  )
}
