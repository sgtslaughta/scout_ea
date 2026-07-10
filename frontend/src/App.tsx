import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/Sidebar'
import { SignatureBar } from '@/components/SignatureBar'
import { TodayBriefing } from '@/components/TodayBriefing'
import { CommandPalette } from '@/components/CommandPalette'
import { RightDrawer } from '@/components/RightDrawer'
import { loadAccent } from '@/theme'

// Lazy-loaded views with named export conversion to default
const DashboardView = lazy(() => import('@/views/Dashboard').then(m => ({ default: m.DashboardView })))
const DeadlinesView = lazy(() => import('@/views/Deadlines').then(m => ({ default: m.DeadlinesView })))
const TrendingView = lazy(() => import('@/views/Trending').then(m => ({ default: m.TrendingView })))
const DocsView = lazy(() => import('@/views/Docs').then(m => ({ default: m.DocsView })))
const SettingsView = lazy(() => import('@/views/Settings').then(m => ({ default: m.SettingsView })))
const InboxView = lazy(() => import('@/views/Inbox').then(m => ({ default: m.InboxView })))
const TasksView = lazy(() => import('@/views/Tasks').then(m => ({ default: m.TasksView })))
const CalendarView = lazy(() => import('@/views/Calendar').then(m => ({ default: m.CalendarView })))
const PeopleView = lazy(() => import('@/views/People').then(m => ({ default: m.PeopleView })))
const TopicsView = lazy(() => import('@/views/Topics').then(m => ({ default: m.TopicsView })))

export function App() {
  const [collapsedSidebar, setCollapsedSidebar] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    loadAccent()
    const today = new Date().toISOString().split('T')[0]
    if (localStorage.getItem('ea-briefing-shown') !== today) {
      setBriefingOpen(true)
      localStorage.setItem('ea-briefing-shown', today)
    }
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setCommandOpen(true)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  return (
    <div className="w-full h-screen flex bg-bg text-text overflow-hidden">
      {/* Command palette overlay */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onViewChange={(id) => navigate(id === 'dashboard' ? '/' : '/' + id)}
        onRefresh={handleRefresh}
      />

      {/* Briefing modal */}
      <TodayBriefing open={briefingOpen} onClose={() => setBriefingOpen(false)} />

      {/* Left Sidebar - 56px */}
      <Sidebar collapsed={collapsedSidebar} onToggle={setCollapsedSidebar} />

      {/* Center column - flex-1 with flex flex-col min-w-0 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top signature bar - 48px tall */}
        <SignatureBar onCommandOpen={() => setCommandOpen(true)} onOpenBriefing={() => setBriefingOpen(true)} />

        {/* Main content + right drawer */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main view - flex-1 */}
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted text-sm">Loading…</div>}>
            <Routes>
              <Route path="/" element={<DashboardView />} />
              <Route path="/inbox" element={<InboxView />} />
              <Route path="/tasks" element={<TasksView />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/trending" element={<TrendingView />} />
              <Route path="/deadlines" element={<DeadlinesView />} />
              <Route path="/people" element={<PeopleView />} />
              <Route path="/topics" element={<TopicsView />} />
              <Route path="/docs" element={<DocsView />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          {/* Right drawer - hidden below 1100px, fixed w-[300px] on desktop */}
          <div className="hidden lg:flex">
            <RightDrawer />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
