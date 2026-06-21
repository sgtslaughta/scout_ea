import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/Sidebar'
import { SignatureBar } from '@/components/SignatureBar'
import { DashboardView } from '@/views/Dashboard'
import { TodayBriefing } from '@/components/TodayBriefing'
import { DeadlinesView } from '@/views/Deadlines'
import { TrendingView } from '@/views/Trending'
import { DocsView } from '@/views/Docs'
import { SettingsView } from '@/views/Settings'
import { InboxView } from '@/views/Inbox'
import { TasksView } from '@/views/Tasks'
import { CalendarView } from '@/views/Calendar'
import { PeopleView } from '@/views/People'
import { TopicsView } from '@/views/Topics'
import { CommandPalette } from '@/components/CommandPalette'
import { RightDrawer } from '@/components/RightDrawer'
import { applyTheme, getStoredMode } from '@/lib/theme'
import './App.css'

export function App() {
  const [collapsedSidebar, setCollapsedSidebar] = useState(false)
  const [activeView, setActiveView] = useState('dashboard')
  const [commandOpen, setCommandOpen] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Restore accent from localStorage on app load
    const stored = localStorage.getItem('ea-accent')
    if (stored) {
      document.documentElement.style.setProperty('--color-accent', stored)
    }
    // Apply theme from localStorage
    applyTheme(getStoredMode())
    // Listen for OS theme changes when mode=system
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (getStoredMode() === 'system') applyTheme('system')
    }
    mql.addEventListener('change', onChange)
    // Auto-open today's briefing once per day
    const today = new Date().toISOString().split('T')[0]
    if (localStorage.getItem('ea-briefing-shown') !== today) {
      setBriefingOpen(true)
      localStorage.setItem('ea-briefing-shown', today)
    }
    return () => mql.removeEventListener('change', onChange)
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

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />
      case 'deadlines':
        return <DeadlinesView />
      case 'trending':
        return <TrendingView />
      case 'docs':
        return <DocsView />
      case 'settings':
        return <SettingsView />
      case 'inbox':
        return <InboxView />
      case 'tasks':
        return <TasksView />
      case 'calendar':
        return <CalendarView />
      case 'people':
        return <PeopleView />
      case 'topics':
        return <TopicsView />
      default:
        return <DashboardView />
    }
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  return (
    <div className="w-full h-screen flex bg-bg text-text overflow-hidden">
      {/* Command palette overlay */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onViewChange={setActiveView}
        onRefresh={handleRefresh}
      />

      {/* Briefing modal */}
      <TodayBriefing open={briefingOpen} onClose={() => setBriefingOpen(false)} />

      {/* Left Sidebar - 56px */}
      <Sidebar collapsed={collapsedSidebar} onToggle={setCollapsedSidebar} activeView={activeView} onViewChange={setActiveView} />

      {/* Center column - flex-1 with flex flex-col min-w-0 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top signature bar - 48px tall */}
        <SignatureBar onCommandOpen={() => setCommandOpen(true)} onOpenBriefing={() => setBriefingOpen(true)} />

        {/* Main content + right drawer */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main view - flex-1 */}
          {renderView()}

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
