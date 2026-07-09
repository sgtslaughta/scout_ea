import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import Dialog from '@mui/material/Dialog'
import { X, AlertCircle } from 'lucide-react'
import { getOutlook, getSignals } from '@/api'
import { SkeletonRow } from '@/components/SkeletonRow'

interface TodayBriefingProps {
  open: boolean
  onClose: () => void
}

export function TodayBriefing({ open, onClose }: TodayBriefingProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const { data: outlook, isLoading: outlookLoading } = useQuery({
    queryKey: ['outlook'],
    queryFn: getOutlook,
    enabled: open,
  })

  const { data: triageSignals = [] } = useQuery({
    queryKey: ['signals', 'new'],
    queryFn: () => getSignals('new'),
    enabled: open && !outlookLoading,
  })

  const regularSignals = triageSignals.filter(s => s.type !== 'proactive')
  const proactiveSignals = outlook?.proactive || []
  const tasksToday = outlook?.tasks_due_today || []

  // Handle Escape key to close modal
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Focus close button when modal opens
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { position: 'relative' } } }}>
            {/* Close button */}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="absolute top-4 right-4 text-muted hover:text-text transition-colors"
              aria-label="Close briefing"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-display font-semibold text-text">
                TODAY'S BRIEFING
              </h2>
              <p className="text-xs text-muted font-mono mt-1">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {outlookLoading ? (
              <div className="space-y-4">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-2 border border-border rounded p-3">
                    <div className="text-[11px] uppercase text-muted mb-1">Meetings</div>
                    <div className="text-xl font-mono font-semibold text-accent">
                      {outlook?.deadlines.length || 0}
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded p-3">
                    <div className="text-[11px] uppercase text-muted mb-1">Due Today</div>
                    <div className="text-xl font-mono font-semibold text-ok">
                      {tasksToday.length}
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded p-3">
                    <div className="text-[11px] uppercase text-muted mb-1">Active</div>
                    <div className="text-xl font-mono font-semibold text-warn">
                      {outlook?.deadlines.filter(d => d.countdown_seconds < 86400).length || 0}
                    </div>
                  </div>
                </div>

                {/* Triaged Signals */}
                {regularSignals.length > 0 && (
                  <div className="bg-surface-2 border border-border rounded-lg p-4">
                    <h3 className="text-[11px] uppercase tracking-wider text-muted mb-3">
                      Signals
                    </h3>
                    <div className="space-y-2 text-xs">
                      {regularSignals.slice(0, 5).map((sig) => (
                        <div
                          key={sig.id}
                          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-surface transition-colors"
                        >
                          <div
                            style={{
                              background:
                                sig.priority <= 1
                                  ? '#E5484D'
                                  : sig.priority === 2
                                    ? '#F2A65A'
                                    : '#6C8FE5',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                            }}
                          />
                          <span className="text-text flex-1 truncate">{sig.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proactive */}
                {proactiveSignals.length > 0 && (
                  <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                    <h3 className="text-[11px] uppercase tracking-wider text-accent mb-3">
                      Proactive
                    </h3>
                    <div className="space-y-2 text-xs">
                      {proactiveSignals.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-start gap-2">
                          <AlertCircle size={14} className="text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-text">{item.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={onClose}
                  className="w-full py-2 rounded font-medium text-xs transition-all"
                  style={{ background: 'var(--color-accent)', color: '#0B1220' }}
                >
                  Start my day
                </button>
              </div>
            )}
    </Dialog>
  )
}
