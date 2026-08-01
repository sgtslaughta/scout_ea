import { ShellLayout } from '@/shell/ShellLayout'
import { useAlertChime } from '@/lib/useAlertChime'

// The app is a single page now. Layout, drawer state and ⌘K all live in
// ShellLayout; nothing routes, so there is no router surface left here.
export function App() {
  useAlertChime()
  return <ShellLayout />
}

export default App
