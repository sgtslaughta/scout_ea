import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, X, Clock, TrendingUp, ChevronDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getOutlook, getDeadlines, getTrends, getSignals, getActivity } from '@/api'
import { SkeletonRow } from '@/components/SkeletonRow'

interface CollapsedState {
  kpi: boolean
  activity: boolean
  trends: boolean
  signals: boolean
  deadlines: boolean
}

const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return 'overdue'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 24) return `${Math.floor(hours / 24)}d`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

const relativeTime = (isoStr: string): string => {
  const d = new Date(isoStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function DashboardView() {
  const [collapsed, setCollapsed] = useState<CollapsedState>({
    kpi: false,
    activity: false,
    trends: false,
    signals: false,
    deadlines: false,
  })

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('dashboard-collapsed')
    if (stored) {
      try {
        setCollapsed(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [])

  // Save to localStorage when collapsed changes
  useEffect(() => {
    localStorage.setItem('dashboard-collapsed', JSON.stringify(collapsed))
  }, [collapsed])

  const toggleCollapsed = (key: keyof CollapsedState) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const { data: outlook, isLoading: outlookLoading } = useQuery({
    queryKey: ['outlook'],
    queryFn: getOutlook,
    refetchInterval: 15000,
  })

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['trends'],
    queryFn: () => getTrends(),
    refetchInterval: 15000,
  })

  const { data: signals = [], isLoading: signalsLoading } = useQuery({
    queryKey: ['signals', 'new'],
    queryFn: () => getSignals('new'),
    refetchInterval: 15000,
  })

  const { data: deadlines = [], isLoading: deadlinesLoading } = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
    refetchInterval: 15000,
  })

  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => getActivity(10),
    refetchInterval: 15000,
  })

  // Activity chart data
  const activityChartData = activity.map((a) => ({
    name: a.skill.slice(0, 8),
    items: a.items_created || 0,
    status: a.status,
  }))

  const triageSignals = signals.filter((s) => s.type !== 'proactive')
  const sortedDeadlines = [...deadlines].sort((a, b) => a.countdown_seconds - b.countdown_seconds)
  const topTrends = [...trends].sort((a, b) => (b.delta || 0) - (a.delta || 0)).slice(0, 5)

  // KPI cards
  const kpiCards = [
    { label: 'Meetings', value: outlook?.deadlines.length || 0, color: 'accent' },
    { label: 'Due Today', value: outlook?.tasks_due_today.length || 0, color: 'ok' },
    {
      label: 'Urgent (<24h)',
      value: deadlines.filter((d) => d.countdown_seconds < 86400).length,
      color: deadlines.some((d) => d.countdown_seconds < 86400 && d.countdown_seconds > 0)
        ? 'warn'
        : 'muted',
    },
    { label: 'Rising', value: trends.filter((t) => (t.delta || 0) > 0).length, color: 'ok' },
    { label: 'Signals', value: triageSignals.length, color: 'info' },
    { label: 'Skill Runs', value: activity.length, color: 'accent' },
  ]

  return (
    <main className="flex-1 overflow-y-auto bg-bg">
      <div className="w-full px-6 py-6">
        {/* horizon ops-clock band lives in the global SignatureBar (App shell) — not duplicated here */}
        <div className="space-y-6">
          {/* KPI Tiles Row */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wider text-muted font-semibold">
                Key Metrics
              </h3>
              <button
                onClick={() => toggleCollapsed('kpi')}
                className="text-muted hover:text-text transition-colors"
                aria-label="Toggle metrics"
              >
                <ChevronDown
                  size={16}
                  style={{
                    transform: collapsed.kpi ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
            </div>
            {!collapsed.kpi && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
              >
                {kpiCards.map((card, i) => (
                  <div key={i} className="bg-surface border border-border rounded-lg p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted mb-2">
                      {card.label}
                    </div>
                    <div
                      className={`text-2xl font-mono font-semibold text-${card.color}`}
                      style={{ color: `var(--color-${card.color})` }}
                    >
                      {outlookLoading ? '—' : card.value}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Activity + Trends Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Activity Chart */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-muted font-semibold">
                  Skill Activity
                </h3>
                <button
                  onClick={() => toggleCollapsed('activity')}
                  className="text-muted hover:text-text transition-colors"
                  aria-label="Toggle activity"
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: collapsed.activity ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>
              </div>
              {!collapsed.activity && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface border border-border rounded-lg p-4"
                >
                  {activityLoading ? (
                    <div className="h-32 flex items-center justify-center text-muted text-xs">
                      Loading…
                    </div>
                  ) : activityChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={activityChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--color-surface-2)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                          }}
                        />
                        <Bar dataKey="items" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-muted text-xs">
                      No activity yet.
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Top Trends */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-muted font-semibold">
                  Trending
                </h3>
                <button
                  onClick={() => toggleCollapsed('trends')}
                  className="text-muted hover:text-text transition-colors"
                  aria-label="Toggle trends"
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: collapsed.trends ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>
              </div>
              {!collapsed.trends && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface border border-border rounded-lg p-4 space-y-2"
                >
                  {trendsLoading ? (
                    <SkeletonRow />
                  ) : topTrends.length > 0 ? (
                    topTrends.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 py-2 px-3 rounded hover:bg-surface-2 transition-colors text-xs">
                        <span className="flex-1 text-text font-medium truncate">{t.term}</span>
                        <div className="flex items-center gap-1 text-muted flex-shrink-0">
                          {t.delta && t.delta > 0 ? (
                            <TrendingUp size={12} className="text-ok" />
                          ) : (
                            <TrendingUp size={12} className="text-muted" />
                          )}
                          <span className="font-mono text-[11px]">{t.score.toFixed(1)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted py-2">No trends yet.</div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Signals + Activity Feeds */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Triaged Signals */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-muted font-semibold">
                  Signals
                </h3>
                <button
                  onClick={() => toggleCollapsed('signals')}
                  className="text-muted hover:text-text transition-colors"
                  aria-label="Toggle signals"
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: collapsed.signals ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>
              </div>
              {!collapsed.signals && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface border border-border rounded-lg p-4"
                >
                  {signalsLoading ? (
                    <div className="space-y-2">
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : triageSignals.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {triageSignals.slice(0, 5).map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 py-2 px-3 rounded hover:bg-surface-2 transition-colors"
                        >
                          <div
                            style={{
                              background:
                                s.priority <= 1 ? '#E5484D' : s.priority === 2 ? '#F2A65A' : '#6C8FE5',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                            }}
                          />
                          <span className="text-text flex-1 truncate">{s.title}</span>
                          <span className="text-muted font-mono text-[10px] flex-shrink-0">
                            {relativeTime(s.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted py-2">No signals.</div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Scout Activity Log */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-muted font-semibold">
                  Scout Runs
                </h3>
                <button
                  onClick={() => toggleCollapsed('deadlines')}
                  className="text-muted hover:text-text transition-colors"
                  aria-label="Toggle activity"
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: collapsed.deadlines ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>
              </div>
              {!collapsed.deadlines && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface border border-border rounded-lg p-4"
                >
                  {activityLoading ? (
                    <div className="space-y-2">
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : activity.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {activity.slice(0, 5).map((a) => (
                        <div
                          key={a.id}
                          className={`flex items-center gap-2 py-2 px-3 rounded transition-colors ${
                            a.status === 'success'
                              ? 'hover:bg-ok/10'
                              : a.status === 'error'
                                ? 'hover:bg-crit/10'
                                : 'hover:bg-surface-2'
                          }`}
                        >
                          {a.status === 'ok' ? (
                            <Check size={14} className="text-ok flex-shrink-0" />
                          ) : a.status === 'error' ? (
                            <X size={14} className="text-crit flex-shrink-0" />
                          ) : (
                            <Check size={14} className="text-ok flex-shrink-0" />
                          )}
                          <span className="text-text flex-1 font-mono truncate">{a.skill}</span>
                          <span className="text-muted text-[10px] font-mono flex-shrink-0">
                            {a.items_created} items
                          </span>
                          <span className="text-muted text-[10px] font-mono flex-shrink-0">
                            {relativeTime(a.ran_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted py-2">No runs yet.</div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Deadlines Bottom */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wider text-muted font-semibold">
                Deadlines Countdown
              </h3>
              <span className="text-xs text-muted font-mono">{sortedDeadlines.length} tracked</span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface border border-border rounded-lg p-4"
            >
              {deadlinesLoading ? (
                <div className="space-y-2">
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : sortedDeadlines.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {sortedDeadlines.slice(0, 8).map((d) => (
                    <div
                      key={d.id}
                      className={`flex items-center gap-3 py-2 px-3 rounded border transition-colors ${
                        d.countdown_seconds < 86400 && d.countdown_seconds > 0
                          ? 'border-warn/30 bg-warn/10'
                          : d.countdown_seconds <= 0
                            ? 'border-crit/30 bg-crit/10'
                            : 'border-border bg-surface-2'
                      }`}
                    >
                      <Clock size={12} className="flex-shrink-0" />
                      <span className="text-text flex-1 truncate font-medium">{d.title}</span>
                      <span className="font-mono text-muted flex-shrink-0">
                        {formatCountdown(d.countdown_seconds)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted py-2">No deadlines tracked yet.</div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  )
}
