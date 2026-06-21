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
    <div className="flex h-screen bg-bg text-text overflow-hidden">
      {/* Left Sidebar - 56px */}
      <Sidebar collapsed={collapsedSidebar} onToggle={setCollapsedSidebar} />

      {/* Center column - flex-1 with flex flex-col min-w-0 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top signature bar - 48px tall */}
        <SignatureBar />

        {/* Main content + right drawer */}
        <div className="flex flex-1 overflow-hidden">
          {/* Today view - flex-1 */}
          <TodayView />

          {/* Right drawer - fixed w-[300px] */}
          <RightDrawer />
        </div>
      </div>
    </div>
  )
}

export default App
