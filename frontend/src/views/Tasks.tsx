import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getTasks, setSignalStatus } from '@/api'
import { toast } from 'sonner'
import { SkeletonRow } from '@/components/SkeletonRow'

const statusFilters = ['open', 'in_progress', 'done', 'dismissed']

export function TasksView() {
  const queryClient = useQueryClient()
  const [activeStatus, setActiveStatus] = useState('open')

  const { data: allTasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
    refetchInterval: 15000,
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('tasks', id, 'done'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Completed')
    },
    onError: () => toast.error('Failed to complete'),
  })

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('tasks', id, 'dismissed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Dismissed')
    },
    onError: () => toast.error('Failed to dismiss'),
  })

  const getPriorityColor = (priority: number): string => {
    if (priority <= 1) return 'var(--color-crit)'
    if (priority === 2) return 'var(--color-warn)'
    return 'var(--color-info)'
  }

  const filteredTasks = activeStatus === 'all'
    ? allTasks
    : allTasks.filter((t) => t.status === activeStatus)

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-bg">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-4">
        <h2 className="text-3xl font-display font-semibold text-text mb-6">Tasks</h2>

        {/* Status filter chips */}
        <div className="flex gap-2 mb-4">
          {statusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeStatus === status
                  ? 'bg-accent text-surface'
                  : 'bg-surface border border-border text-muted hover:border-accent'
              }`}
            >
              {status.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2 justify-between">
            <span>Error loading tasks</span>
            <button onClick={() => refetch()} className="underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Tasks list */}
        {isLoading ? (
          <div className="space-y-0">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-sm">
            No tasks yet.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {filteredTasks.map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    style={{
                      background: getPriorityColor(t.priority),
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      flexShrink: 0,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{t.title}</div>
                    {t.detail && (
                      <div className="text-xs text-muted truncate">{t.detail}</div>
                    )}
                    {t.due_at && (
                      <div className="text-xs text-muted font-mono mt-1">
                        {new Date(t.due_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => completeMutation.mutate(t.id)}
                    disabled={completeMutation.isPending}
                    className="px-3 py-2 text-xs font-medium bg-accent text-surface rounded hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => dismissMutation.mutate(t.id)}
                    disabled={dismissMutation.isPending}
                    className="px-3 py-2 text-xs font-medium bg-surface-2 border border-border text-muted rounded hover:border-text disabled:opacity-50 transition-colors"
                  >
                    Dismiss
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
