import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import RouteErrorBoundary from '@/components/RouteErrorBoundary'
import { Sidebar } from '@/components/Sidebar'
import { SignatureBar } from '@/components/SignatureBar'
import { TodayBriefing } from '@/components/TodayBriefing'
import { CommandPalette } from '@/components/CommandPalette'
import { Quickdraw } from '@/components/quickdraw/Quickdraw'
import { useAlertChime } from '@/lib/useAlertChime'

// Lazy-loaded views with named export conversion to default
const DashboardView = lazy(() => import('@/views/Dashboard').then(m => ({ default: m.DashboardView })))
const DataFeedView = lazy(() => import('@/views/DataFeed').then(m => ({ default: m.DataFeedView })))
const SettingsView = lazy(() => import('@/views/Settings').then(m => ({ default: m.SettingsView })))
const TasksView = lazy(() => import('@/views/Tasks').then(m => ({ default: m.TasksView })))
const PeopleView = lazy(() => import('@/views/People').then(m => ({ default: m.PeopleView })))
const ScheduleView = lazy(() => import('@/views/Schedule').then(m => ({ default: m.ScheduleView })))
const AutomationsView = lazy(() => import('@/views/Automations').then(m => ({ default: m.AutomationsView })))

export function App() {
  const [collapsedSidebar, setCollapsedSidebar] = useState(
    () => localStorage.getItem('ea-sidebar-collapsed') === 'true',
  )
  const [commandOpen, setCommandOpen] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  useAlertChime()

  useEffect(() => {
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
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', overflow: 'hidden', bgcolor: 'background.default', color: 'text.primary' }}>
      {/* Command palette overlay */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onViewChange={(path) => navigate(path)}
        onRefresh={handleRefresh}
      />

      {/* Briefing modal */}
      <TodayBriefing open={briefingOpen} onClose={() => setBriefingOpen(false)} />

      {/* Left Sidebar - 56px */}
      <Sidebar
        collapsed={collapsedSidebar}
        onToggle={(c) => { setCollapsedSidebar(c); localStorage.setItem('ea-sidebar-collapsed', String(c)) }}
      />

      {/* Center column - flex-1 with flex flex-col min-w-0 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top signature bar - 48px tall */}
        <SignatureBar onCommandOpen={() => setCommandOpen(true)} onOpenBriefing={() => setBriefingOpen(true)} />

        {/* Main content + right drawer */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Main view - flex-1 with texture backdrop */}
          <Box sx={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <Box className="texture-backdrop" aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
            <Box sx={{ position: 'relative', zIndex: 1, height: '100%', overflow: 'auto' }}>
              <Suspense fallback={<Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', fontSize: 14 }}>Loading…</Box>}>
                <RouteErrorBoundary key={location.pathname}>
                  <Routes>
                    <Route path="/" element={<DashboardView />} />
                    <Route path="/tasks" element={<TasksView />} />
                    <Route path="/schedule" element={<ScheduleView />} />
                    <Route path="/feed" element={<DataFeedView />} />
                    <Route path="/people" element={<PeopleView />} />
                    <Route path="/automations" element={<AutomationsView />} />
                    <Route path="/settings" element={<SettingsView />} />

                    {/* legacy redirects — preserve bookmarks + ⌘K deep links */}
                    <Route path="/review" element={<Navigate to="/feed?view=inbox" replace />} />
                    <Route path="/inbox" element={<Navigate to="/feed?view=inbox" replace />} />
                    <Route path="/actions" element={<Navigate to="/feed?view=actions" replace />} />
                    <Route path="/deadlines" element={<Navigate to="/schedule" replace />} />
                    <Route path="/calendar" element={<Navigate to="/schedule?tab=calendar" replace />} />
                    <Route path="/skills" element={<Navigate to="/automations" replace />} />
                    <Route path="/activity" element={<Navigate to="/automations?tab=activity" replace />} />
                    <Route path="/trending" element={<Navigate to="/feed?view=trending" replace />} />
                    <Route path="/topics" element={<Navigate to="/feed?view=topics" replace />} />
                    <Route path="/docs" element={<Navigate to="/automations" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </RouteErrorBoundary>
              </Suspense>
            </Box>
          </Box>

          {/* Right drawer - hidden below 1100px, fixed w-[300px] on desktop */}
          <Box sx={{ display: { xs: 'none', lg: 'flex' } }}>
            <Quickdraw />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default App
