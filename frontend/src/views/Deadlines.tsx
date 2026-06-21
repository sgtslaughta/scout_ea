import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { getDeadlines, addDeadline, setDeadlineVisible, setConfig } from '@/api'
import { toast } from 'sonner'
import { SkeletonRow } from '@/components/SkeletonRow'

const formatCountdown = (seconds: number): string => {
  if (seconds < 0) return 'Overdue'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

const getUrgencyColor = (seconds: number): string => {
  if (seconds < 86400) return '#E5484D' // < 24h: red
  if (seconds < 604800) return '#F2A65A' // < 7d: orange
  return '#6C8FE5' // blue
}

export function DeadlinesView() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [detail, setDetail] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data: deadlines = [], isLoading, error, refetch } = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  const { data: config = {} } = useQuery({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
  })

  const addMutation = useMutation({
    mutationFn: () => addDeadline(title, dueAt, detail),
    onSuccess: () => {
      toast.success('Deadline added')
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      setTitle('')
      setDueAt('')
      setDetail('')
      setShowForm(false)
    },
    onError: () => toast.error('Failed to add deadline'),
  })

  const visibilityMutation = useMutation({
    mutationFn: (vars: { id: number; visible: boolean }) =>
      setDeadlineVisible(vars.id, vars.visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
    },
    onError: () => toast.error('Failed to update visibility'),
  })

  const globalToggleMutation = useMutation({
    mutationFn: (value: string) => setConfig('deadlines_visible_global', value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      toast.success('Global deadlines toggle updated')
    },
  })

  const globalEnabled = config.deadlines_visible_global !== '0'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dueAt) {
      toast.error('Title and due date required')
      return
    }
    // ponytail: dueAt is already ISO from datetime-local input
    addMutation.mutate()
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-bg">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-display font-semibold text-text">Deadlines</h2>
          <div className="flex items-center gap-3">
            <button
              role="switch"
              aria-checked={globalEnabled}
              onClick={() =>
                globalToggleMutation.mutate(globalEnabled ? '0' : '1')
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                globalEnabled
                  ? 'bg-accent'
                  : 'bg-surface-2 border border-border'
              }`}
              aria-label="Show all deadlines"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-surface transition-transform ${
                  globalEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <label className="text-sm text-muted">Show all deadlines</label>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2 justify-between">
            <span>Error loading deadlines</span>
            <button onClick={() => refetch()} className="underline hover:no-underline">Retry</button>
          </div>
        )}

        {!globalEnabled && (
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 text-sm text-accent">
            Global deadline toggle is off. Turn it on above to see all deadlines.
          </div>
        )}

        {/* Add deadline form */}
        {showForm ? (
          <div className="bg-surface border border-border rounded-lg p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Deadline title"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Due Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Details (optional)
                </label>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Additional details"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="flex-1 bg-accent text-surface rounded-md px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {addMutation.isPending ? 'Adding...' : 'Add Deadline'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-surface-2 border border-border text-muted rounded-md px-3 py-2 text-sm font-medium hover:border-text"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="bg-accent/10 border border-accent/30 text-accent rounded-lg px-4 py-3 text-sm font-medium hover:bg-accent/20 transition-colors"
          >
            + Add Deadline
          </button>
        )}

        {/* Deadlines list */}
        {isLoading ? (
          <div className="space-y-0">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : deadlines.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-sm">
            No deadlines. {!globalEnabled && 'Enable the toggle above to see all.'}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {deadlines.map((d, idx) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{d.title}</div>
                  {d.detail && (
                    <div className="text-xs text-muted truncate">{d.detail}</div>
                  )}
                  <div className="text-xs text-muted font-mono mt-1">
                    {new Date(d.due_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div
                  className="text-xs font-mono px-2 py-1 rounded flex-shrink-0"
                  style={{ color: getUrgencyColor(d.countdown_seconds), background: 'var(--color-surface-2)' }}
                >
                  {formatCountdown(d.countdown_seconds)}
                </div>

                <div className="px-2 py-1 text-xs bg-surface-2 border border-border/50 text-muted rounded flex-shrink-0">
                  {d.source}
                </div>

                <button
                  onClick={() =>
                    visibilityMutation.mutate({ id: d.id, visible: !d.visible })
                  }
                  className="w-5 h-5 flex items-center justify-center text-muted group-hover:text-accent transition-colors flex-shrink-0"
                  aria-label={d.visible ? 'Hide' : 'Show'}
                >
                  {d.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
