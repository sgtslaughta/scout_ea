import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { getDeadlines, getTrends } from '@/api'

const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return '0m'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function RightDrawer() {
  const { data: deadlines = [], isLoading: deadlinesLoading, error: deadlinesError } = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  const { data: trends = [], isLoading: trendsLoading, error: trendsError } = useQuery({
    queryKey: ['trends'],
    queryFn: () => getTrends(),
  })
  const sortedDeadlines = [...deadlines].sort(
    (a, b) => a.countdown_seconds - b.countdown_seconds
  )
  const isUrgent = (seconds: number) => seconds < 86400 // < 24h
  const deadlinesError_ = (deadlinesError || trendsError) as Error | null

  return (
    <div className="w-[300px] border-l border-border flex flex-col overflow-hidden bg-bg">
      {deadlinesError_ && (
        <div className="text-xs text-red-500 p-4">Error loading drawer</div>
      )}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
        {/* Deadlines section */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-muted mb-3">Deadlines</h3>
          {deadlinesLoading ? (
            <div className="text-xs text-muted py-2">Loading…</div>
          ) : sortedDeadlines.length === 0 ? (
            <div className="text-xs text-muted py-2">No deadlines tracked.</div>
          ) : (
            <div className="space-y-2">
              {sortedDeadlines.map((item) => (
                <div
                  key={item.id}
                  className={`px-3 py-2 rounded text-xs border transition-colors ${
                    isUrgent(item.countdown_seconds)
                      ? 'border-crit/40 bg-crit/10'
                      : 'border-border bg-surface-2'
                  }`}
                >
                  <div className="font-medium text-text mb-1">{item.title}</div>
                  <div className="flex items-center gap-1.5 text-muted font-mono text-[11px]">
                    <Clock size={12} className="flex-shrink-0" />
                    <span>{formatCountdown(item.countdown_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trending section */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-muted mb-3">Trending</h3>
          {trendsLoading ? (
            <div className="text-xs text-muted py-2">Loading…</div>
          ) : trends.length === 0 ? (
            <div className="text-xs text-muted py-2">No trends data.</div>
          ) : (
            <div className="space-y-1.5">
              {trends.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 rounded text-xs border border-border bg-surface-2 hover:bg-[#253a52] transition-colors"
                >
                  <span className="text-xs text-text font-medium flex-1">{item.term}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.delta && item.delta > 0 ? (
                      <TrendingUp size={12} className="text-ok" />
                    ) : (
                      <TrendingDown size={12} className="text-muted" />
                    )}
                    <span className="text-xs text-muted font-mono">
                      {item.delta ? (item.delta > 0 ? '+' : '') + item.delta + '%' : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
