import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getEvents, setSignalStatus } from '@/api'
import { toast } from 'sonner'
import { SkeletonRow } from '@/components/SkeletonRow'

export function CalendarView() {
  const queryClient = useQueryClient()

  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    refetchInterval: 15000,
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('events', id, 'approved'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success('Approved')
    },
    onError: () => toast.error('Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      setSignalStatus('events', id, 'rejected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success('Rejected')
    },
    onError: () => toast.error('Failed to reject'),
  })

  const parseJsonSafe = <T,>(json: string | undefined): T[] => {
    if (!json) return []
    try {
      return JSON.parse(json)
    } catch {
      return []
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-bg">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-4">
        <h2 className="text-3xl font-display font-semibold text-text mb-6">Calendar</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2 justify-between">
            <span>Error loading events</span>
            <button onClick={() => refetch()} className="underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Events list */}
        {isLoading ? (
          <div className="space-y-0">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : events.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-sm">
            No events scheduled.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((e, idx) => {
              const proposedTimes = parseJsonSafe<string>(e.proposed_times)
              const attendeesList = parseJsonSafe<string>(e.attendees)
              const chosenTime = e.chosen_time

              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="bg-surface border border-border rounded-lg p-4 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-sm font-medium text-text">{e.title}</div>
                      {e.body && (
                        <div className="text-xs text-muted mt-1">{e.body}</div>
                      )}
                    </div>
                    <span className="text-xs bg-surface-2 border border-border/50 text-muted rounded px-2 py-1 flex-shrink-0">
                      {e.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {chosenTime ? (
                      <div className="text-xs font-mono text-text bg-accent/10 border border-accent/30 rounded px-2 py-1 w-fit">
                        {chosenTime}
                      </div>
                    ) : proposedTimes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {proposedTimes.slice(0, 3).map((time, i) => (
                          <div
                            key={i}
                            className="text-xs font-mono text-muted bg-surface-2 border border-border/50 rounded px-2 py-1"
                          >
                            {time}
                          </div>
                        ))}
                        {proposedTimes.length > 3 && (
                          <div className="text-xs text-muted">
                            +{proposedTimes.length - 3} more
                          </div>
                        )}
                      </div>
                    ) : null}

                    {attendeesList.length > 0 && (
                      <div className="text-xs text-muted">
                        {attendeesList.length} {attendeesList.length === 1 ? 'attendee' : 'attendees'}
                      </div>
                    )}
                  </div>

                  {e.status === 'suggested' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveMutation.mutate(e.id)}
                        disabled={approveMutation.isPending}
                        className="flex-1 px-3 py-2 text-xs font-medium bg-accent text-surface rounded hover:opacity-90 disabled:opacity-50 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(e.id)}
                        disabled={rejectMutation.isPending}
                        className="flex-1 px-3 py-2 text-xs font-medium bg-surface-2 border border-border text-muted rounded hover:border-text disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
