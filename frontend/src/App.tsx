import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { SignatureBar } from '@/components/SignatureBar'
import { TodayView } from '@/views/Today'
import { RightDrawer } from '@/components/RightDrawer'
import './App.css'

export function App() {
  const [collapsedSidebar, setCollapsedSidebar] = useState(false)

  useEffect(() => {
    // Focus management for keyboard nav
    document.addEventListener('keydown', (e) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        // TODO: Open command palette
      }
    })
  }, [])

  return (
    <div className="flex h-screen w-screen bg-bg text-text overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar collapsed={collapsedSidebar} onToggle={setCollapsedSidebar} />

      {/* Main content area */}
      <div className="flex flex-col flex-1">
        {/* Top signature bar */}
        <SignatureBar />

        {/* Main content + right drawer */}
        <div className="flex flex-1 overflow-hidden">
          {/* Today view */}
          <div className="flex-1 overflow-y-auto">
            <TodayView />
          </div>

          {/* Right drawer */}
          <RightDrawer />
        </div>
      </div>
    </div>
  )
}

export default App
