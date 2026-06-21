import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { SignatureBar } from '@/components/SignatureBar'
import { TodayView } from '@/views/Today'
import { DeadlinesView } from '@/views/Deadlines'
import { TrendingView } from '@/views/Trending'
import { RightDrawer } from '@/components/RightDrawer'
import './App.css'

export function App() {
  const [collapsedSidebar, setCollapsedSidebar] = useState(false)
  const [activeView, setActiveView] = useState('today')

  useEffect(() => {
    // Focus management for keyboard nav
    document.addEventListener('keydown', (e) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        // TODO: Open command palette
      }
    })
  }, [])

  const renderView = () => {
    switch (activeView) {
      case 'deadlines':
        return <DeadlinesView />
      case 'trending':
        return <TrendingView />
      default:
        return <TodayView />
    }
  }

  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden">
      {/* Left Sidebar - 56px */}
      <Sidebar collapsed={collapsedSidebar} onToggle={setCollapsedSidebar} activeView={activeView} onViewChange={setActiveView} />

      {/* Center column - flex-1 with flex flex-col min-w-0 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top signature bar - 48px tall */}
        <SignatureBar />

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
