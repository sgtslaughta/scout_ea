import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/Sidebar'
import { SignatureBar } from '@/components/SignatureBar'
import { TodayView } from '@/views/Today'
import { DeadlinesView } from '@/views/Deadlines'
import { TrendingView } from '@/views/Trending'
import { DocsView } from '@/views/Docs'
import { SettingsView } from '@/views/Settings'
import { ComingSoonView } from '@/views/ComingSoon'
import { CommandPalette } from '@/components/CommandPalette'
import { RightDrawer } from '@/components/RightDrawer'
import './App.css'

export function App() {
  const [collapsedSidebar, setCollapsedSidebar] = useState(false)
  const [activeView, setActiveView] = useState('today')
  const [commandOpen, setCommandOpen] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Restore accent from localStorage on app load
    const stored = localStorage.getItem('ea-accent')
    if (stored) {
      document.documentElement.style.setProperty('--color-accent', stored)
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

  const renderView = () => {
    switch (activeView) {
      case 'deadlines':
        return <DeadlinesView />
      case 'trending':
        return <TrendingView />
      case 'docs':
        return <DocsView />
      case 'settings':
        return <SettingsView />
      case 'inbox':
      case 'tasks':
      case 'calendar':
        return <ComingSoonView title={activeView.charAt(0).toUpperCase() + activeView.slice(1)} />
      default:
        return <TodayView />
    }
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden">
      {/* Command palette overlay */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onViewChange={setActiveView}
        onRefresh={handleRefresh}
      />

      {/* Left Sidebar - 56px */}
      <Sidebar collapsed={collapsedSidebar} onToggle={setCollapsedSidebar} activeView={activeView} onViewChange={setActiveView} />

      {/* Center column - flex-1 with flex flex-col min-w-0 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top signature bar - 48px tall */}
        <SignatureBar onCommandOpen={() => setCommandOpen(true)} />

        {/* Main content + right drawer */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main view - flex-1 */}
          {renderView()}

          {/* Right drawer - fixed w-[300px] */}
          <RightDrawer />
        </div>
      </div>
    </div>
  )
}

export default App
