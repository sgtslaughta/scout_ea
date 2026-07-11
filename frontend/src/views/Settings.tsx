import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useColorScheme } from '@mui/material/styles'
import {
  Box,
  Button,
  Chip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
} from '@mui/material'
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

const getCheckColor = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 150 ? '#000' : '#fff'
}

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
      if (n > 0) {
        toast.success(`Sent to ${n} subscription(s)`)
      } else {
        toast.info('No active subscriptions — enable notifications first (requires a real browser + push service)')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send test'
      toast.error(msg)
    } finally {
      setLoadingPush(false)
    }
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ height: 64, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', px: 3 }}>
        <Typography variant="h6">Settings</Typography>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        {/* Appearance section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="overline" sx={{ display: 'block', mb: 2, fontWeight: 600 }}>
            Appearance
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Accent color picker */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                Accent Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                {ACCENT_COLORS.map((color) => (
                  <IconButton
                    key={color.hex}
                    onClick={() => setCurrentAccent(color.hex)}
                    title={color.name}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1,
                      p: 0,
                      position: 'relative',
                      bgcolor: color.hex,
                      border: '2px solid',
                      borderColor: currentAccent === color.hex ? 'primary.main' : 'action.disabled',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'scale(1.1)',
                      },
                    }}
                  >
                    {currentAccent === color.hex && (
                      <Check size={20} style={{ color: getCheckColor(color.hex) }} />
                    )}
                  </IconButton>
                ))}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Currently: <span style={{ fontFamily: 'monospace' }}>{currentAccent}</span>
              </Typography>
            </Box>

            {/* Theme selector */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                Theme
              </Typography>
              <ToggleButtonGroup
                value={mode || 'system'}
                exclusive
                onChange={(_e, newMode) => {
                  if (newMode !== null) {
                    setMode(newMode as 'light' | 'dark' | 'system')
                  }
                }}
                sx={{ mb: 1.5 }}
              >
                {(['light', 'dark', 'system'] as const).map((themeMode) => (
                  <ToggleButton
                    key={themeMode}
                    value={themeMode}
                    aria-label={themeMode}
                  >
                    {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Currently: <span style={{ fontFamily: 'monospace' }}>{mode ?? 'system'}</span>
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Notifications section */}
        <Box>
          <Typography variant="overline" sx={{ display: 'block', mb: 2, fontWeight: 600 }}>
            Notifications
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Push notification control */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                Browser Notifications
              </Typography>

              {pushState === 'unsupported' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Button
                    disabled
                    fullWidth
                    sx={{ opacity: 0.5, cursor: 'not-allowed' }}
                  >
                    Notifications not supported
                  </Button>
                </Box>
              )}

              {pushState === 'denied' && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Notifications blocked in browser settings.
                </Typography>
              )}

              {pushState === 'unsubscribed' && (
                <Button
                  variant="contained"
                  onClick={handleEnablePush}
                  disabled={loadingPush}
                  fullWidth
                >
                  {loadingPush ? 'Enabling...' : 'Enable notifications'}
                </Button>
              )}

              {pushState === 'subscribed' && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={handleDisablePush}
                    disabled={loadingPush}
                    sx={{ flex: 1 }}
                  >
                    {loadingPush ? 'Disabling...' : 'Disable notifications'}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSendTest}
                    disabled={loadingPush}
                  >
                    {loadingPush ? 'Sending...' : 'Send test'}
                  </Button>
                </Box>
              )}

              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  State:
                </Typography>
                <Chip
                  label={pushState}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
