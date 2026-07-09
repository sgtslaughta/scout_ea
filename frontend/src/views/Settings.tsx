import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useColorScheme } from '@mui/material/styles'
import { applyAccent } from '@/theme'
import {
  getSubscriptionState,
  enablePush,
  disablePush,
  sendTestPush,
  type SubscriptionState
} from '@/lib/push'

const ACCENT_COLORS = [
  { name: 'Amber', hex: '#F2A65A' },
  { name: 'Indigo', hex: '#6C8FE5' },
  { name: 'Emerald', hex: '#3DD68C' },
  { name: 'Coral', hex: '#E5484D' },
  { name: 'Violet', hex: '#A78BFA' },
]

export function SettingsView() {
  const { mode, setMode } = useColorScheme()
  const [currentAccent, setCurrentAccent] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ea-accent') || '#F2A65A'
    }
    return '#F2A65A'
  })
  const [pushState, setPushState] = useState<SubscriptionState>('unsupported')
  const [loadingPush, setLoadingPush] = useState(false)

  useEffect(() => {
    applyAccent(currentAccent)
  }, [currentAccent])

  useEffect(() => {
    const loadPushState = async () => {
      const state = await getSubscriptionState()
      setPushState(state)
    }
    loadPushState()
  }, [])

  const handleEnablePush = async () => {
    setLoadingPush(true)
    try {
      await enablePush()
      toast.success('Notifications enabled')
      const state = await getSubscriptionState()
      setPushState(state)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable notifications'
      toast.error(msg)
    } finally {
      setLoadingPush(false)
    }
  }

  const handleDisablePush = async () => {
    setLoadingPush(true)
    try {
      await disablePush()
      toast.success('Notifications disabled')
      const state = await getSubscriptionState()
      setPushState(state)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disable notifications'
      toast.error(msg)
    } finally {
      setLoadingPush(false)
    }
  }

  const handleSendTest = async () => {
    setLoadingPush(true)
    try {
      const n = await sendTestPush()
      toast.success(`Sent ${n}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send test'
      toast.error(msg)
    } finally {
      setLoadingPush(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-6">
        <h1 className="text-display text-lg text-text">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Appearance section */}
        <div className="mb-8">
          <h2 className="text-display text-base text-text font-medium mb-4">
            Appearance
          </h2>

          <div className="space-y-4">
            {/* Accent color picker */}
            <div>
              <label className="text-sm text-muted block mb-3">Accent Color</label>
              <div className="flex gap-3">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => setCurrentAccent(color.hex)}
                    className="group relative"
                    title={color.name}
                  >
                    <div
                      className="w-12 h-12 rounded-lg border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color.hex,
                        borderColor:
                          currentAccent === color.hex
                            ? '#E6EDF7'
                            : '#243149',
                      }}
                    />
                    {currentAccent === color.hex && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check size={20} className="text-bg" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">
                Currently: <span className="font-mono">{currentAccent}</span>
              </p>
            </div>

            {/* Theme selector */}
            <div>
              <label className="text-sm text-muted block mb-3">Theme</label>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map((themeMode) => (
                  <button
                    key={themeMode}
                    onClick={() => {
                      setMode(themeMode)
                    }}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      mode === themeMode
                        ? 'bg-accent text-bg'
                        : 'bg-surface-2 text-text border border-border hover:border-accent'
                    }`}
                  >
                    {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">
                Currently: <span className="font-mono">{mode ?? 'system'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Notifications section */}
        <div className="mb-8">
          <h2 className="text-display text-base text-text font-medium mb-4">
            Notifications
          </h2>

          <div className="space-y-4">
            {/* Push notification control */}
            <div>
              <label className="text-sm text-muted block mb-3">Browser Notifications</label>
              <div className="flex items-center gap-3">
                {pushState === 'unsupported' && (
                  <>
                    <button
                      disabled
                      className="flex-1 py-2 px-3 rounded text-sm font-medium bg-surface-2 text-muted opacity-50 cursor-not-allowed"
                      aria-label="Notifications not supported"
                    >
                      Notifications not supported
                    </button>
                  </>
                )}
                {pushState === 'denied' && (
                  <p className="text-sm text-muted">Notifications blocked in browser settings.</p>
                )}
                {pushState === 'unsubscribed' && (
                  <button
                    onClick={handleEnablePush}
                    disabled={loadingPush}
                    className="flex-1 py-2 px-3 rounded text-sm font-medium bg-accent text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    aria-label="Enable browser notifications"
                  >
                    {loadingPush ? 'Enabling...' : 'Enable notifications'}
                  </button>
                )}
                {pushState === 'subscribed' && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDisablePush}
                      disabled={loadingPush}
                      className="flex-1 py-2 px-3 rounded text-sm font-medium bg-surface-2 text-text border border-border hover:border-accent disabled:opacity-50 transition-colors"
                      aria-label="Disable browser notifications"
                    >
                      {loadingPush ? 'Disabling...' : 'Disable notifications'}
                    </button>
                    <button
                      onClick={handleSendTest}
                      disabled={loadingPush}
                      className="py-2 px-4 rounded text-sm font-medium bg-accent text-bg hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                      aria-label="Send test notification"
                    >
                      {loadingPush ? 'Sending...' : 'Send test'}
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted mt-2">
                State: <span className="font-mono">{pushState}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
