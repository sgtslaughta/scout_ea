import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getSignals, setSignalStatus } from '@/api'
import { toast } from 'sonner'
import { SkeletonRow } from '@/components/SkeletonRow'

const statusFilters = ['new', 'triaged', 'actioned', 'dismissed']

export function InboxView() {
  const queryClient = useQueryClient()
  const [activeStatus, setActiveStatus] = useState('new')

  const { data: signals = [], isLoading, error, refetch } = useQuery({
    queryKey: ['signals', activeStatus],
    queryFn: () => getSignals(activeStatus),
    refetchInterval: 15000,
  })

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('signals', id, 'dismissed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      toast.success('Dismissed')
    },
    onError: () => toast.error('Failed to dismiss'),
  })

  const triageMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('signals', id, 'triaged'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      toast.success('Triaged')
    },
    onError: () => toast.error('Failed to triage'),
  })

  const getSeverityColor = (priority: number): string => {
    if (priority <= 1) return 'var(--color-crit)'
    if (priority === 2) return 'var(--color-warn)'
    return 'var(--color-info)'
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-bg">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-4">
        <h2 className="text-3xl font-display font-semibold text-text mb-6">Inbox</h2>

        {/* Status filter chips */}
        <div className="flex gap-2 mb-4">
          {statusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeStatus === status
                  ? 'bg-accent text-[#0B1220]'
                  : 'bg-surface-2 border border-border text-muted hover:border-accent'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2 justify-between">
            <span>Error loading signals</span>
            <button onClick={() => refetch()} className="underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Signals list */}
        {isLoading ? (
          <div className="space-y-0">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : signals.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-sm">
            Inbox is clear.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {signals.map((s, idx) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    style={{
                      background: getSeverityColor(s.priority),
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      flexShrink: 0,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{s.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-surface-2 border border-border/50 text-muted rounded px-2 py-0.5 flex-shrink-0">
                        {s.source}{s.source_skill ? ` · ${s.source_skill}` : ''}
                      </span>
                      <span className="text-xs text-muted font-mono flex-shrink-0">
                        {new Date(s.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => dismissMutation.mutate(s.id)}
                    disabled={dismissMutation.isPending}
                    className="px-3 py-2 text-xs font-medium bg-surface-2 border border-border text-muted rounded hover:border-text disabled:opacity-50 transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => triageMutation.mutate(s.id)}
                    disabled={triageMutation.isPending}
                    className="px-3 py-2 text-xs font-medium bg-accent text-[#0B1220] rounded hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    Triage
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
