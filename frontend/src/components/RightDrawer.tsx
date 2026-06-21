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
    <div className="w-80 bg-bg border-l border-border flex flex-col overflow-hidden">
      {/* Container with padding */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
        {/* Deadlines section - surface card */}
        <div className="bg-surface border border-border rounded-md overflow-hidden flex-1">
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-display font-semibold uppercase tracking-wide mb-3 text-muted">
              Deadlines
            </h3>
          </div>
          <div className="overflow-y-auto p-3 space-y-2 max-h-48">
            {MOCK_DEADLINES.map((item) => (
              <div
                key={item.id}
                className={`px-3 py-2 rounded-md text-xs border transition-colors ${
                  item.severity === 'urgent'
                    ? 'border-crit/40 bg-crit/15 hover:bg-crit/25'
                    : 'border-border bg-surface-2 hover:bg-surface-2/80'
                }`}
              >
                <div className="font-medium text-text mb-1">{item.title}</div>
                <div className="flex items-center gap-1.5 text-muted font-mono text-xs">
                  <Clock size={12} className="flex-shrink-0" />
                  <span>{item.timeLeft}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trending section - surface card */}
        <div className="bg-surface border border-border rounded-md overflow-hidden flex-1">
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-display font-semibold uppercase tracking-wide mb-3 text-muted">
              Trending
            </h3>
          </div>
          <div className="overflow-y-auto p-3 space-y-1.5 max-h-48">
            {MOCK_TRENDING.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2 rounded-md border border-border hover:bg-surface-2 transition-colors"
              >
                <span className="text-xs text-text font-medium flex-1">{item.term}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.trend === 'up' ? (
                    <TrendingUp size={12} className="text-ok" />
                  ) : (
                    <TrendingDown size={12} className="text-muted" />
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
