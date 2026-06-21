import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getTrends, type Trend } from '@/api'
import { TrendingUp, TrendingDown } from 'lucide-react'

export function TrendingView() {
  const { data: trends = [], isLoading, error } = useQuery<Trend[]>({
    queryKey: ['trends'],
    queryFn: () => getTrends(),
  })

  if (error) {
    return (
      <main className="flex-1 overflow-y-auto p-6" style={{ background: '#0B1220' }}>
        <div className="max-w-[1080px] mx-auto">
          <div className="text-red-500 text-sm">Error loading trends</div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-6" style={{ background: '#0B1220' }}>
      <div className="max-w-[1080px] mx-auto flex flex-col gap-4">
        <div className="mb-6">
          <h2 className="text-3xl font-display font-semibold text-text">Trending</h2>
          <div className="text-xs text-muted font-mono">Top trends from your signals</div>
        </div>

        {isLoading ? (
          <div className="text-xs text-muted py-8">Loading trends…</div>
        ) : trends.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-sm">
            No trending data yet.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {trends.map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{t.term}</div>
                  <div className="text-xs text-muted font-mono mt-1">
                    {t.kind} {t.count ? `• ${t.count} signals` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-sm font-mono text-text">{t.score.toFixed(1)}</div>
                  {t.delta !== undefined && (
                    <div
                      className="flex items-center gap-1"
                      style={{ color: t.delta > 0 ? '#10B981' : '#6B7280' }}
                    >
                      {t.delta > 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      <span className="text-xs font-mono">{Math.abs(t.delta).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
