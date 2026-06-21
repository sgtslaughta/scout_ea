import { TrendingUp, TrendingDown, Clock } from 'lucide-react'

const MOCK_DEADLINES = [
  { id: '1', title: 'Q3 roadmap review', timeLeft: '6h 23m', severity: 'urgent' as const },
  { id: '2', title: 'Budget approval', timeLeft: '1d 4h', severity: 'normal' as const },
  { id: '3', title: 'Team sync prep', timeLeft: '28m', severity: 'urgent' as const },
]

const MOCK_TRENDING = [
  { id: '1', term: 'AI Strategy', trend: 'up', change: '+8%' },
  { id: '2', term: 'Launch Timeline', trend: 'up', change: '+5%' },
  { id: '3', term: 'Vendor Risk', trend: 'down', change: '-3%' },
]

export function RightDrawer() {
  return (
    <div className="w-72 bg-surface border-l border-border flex flex-col overflow-hidden">
      {/* Deadlines section */}
      <div className="flex-1 overflow-y-auto border-b border-border">
        <div className="p-4">
          <h3 className="text-xs font-display font-semibold uppercase tracking-wide mb-3 text-muted">
            Deadlines
          </h3>
          <div className="space-y-2">
            {MOCK_DEADLINES.map((item) => (
              <div
                key={item.id}
                className={`px-3 py-2 rounded text-xs border ${
                  item.severity === 'urgent'
                    ? 'border-crit/30 bg-crit/10'
                    : 'border-border bg-surface-2'
                }`}
              >
                <div className="font-medium text-text mb-1">{item.title}</div>
                <div className="flex items-center gap-1 text-muted font-mono">
                  <Clock size={10} />
                  {item.timeLeft}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trending section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-display font-semibold uppercase tracking-wide mb-3 text-muted">
            Trending
          </h3>
          <div className="space-y-2">
            {MOCK_TRENDING.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2 rounded border border-border hover:bg-surface-2 transition-colors"
              >
                <span className="text-xs text-text font-medium">{item.term}</span>
                <div className="flex items-center gap-1">
                  {item.trend === 'up' ? (
                    <TrendingUp size={12} className="text-ok" />
                  ) : (
                    <TrendingDown size={12} className="text-crit" />
                  )}
                  <span className="text-xs text-muted font-mono">{item.change}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
