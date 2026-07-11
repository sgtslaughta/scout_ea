import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useColorScheme } from '@mui/material/styles'
import {
  Box,
  Button,
  Chip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
} from '@mui/material'
import { useThemeSelection, THEMES } from '@/themes/ThemeSelectionProvider'
import { useTimePrefs } from '@/lib/timePrefs'
import { COMMON_ZONES, effectiveZone, formatFriendly } from '@/lib/datetime'

const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`
import {
  getSubscriptionState,
  enablePush,
  disablePush,
  sendTestPush,
  type SubscriptionState
} from '@/lib/push'

export function SettingsView() {
  const { mode, setMode } = useColorScheme()
  const { selectedKey, setThemeKey } = useThemeSelection()
  const { timeZone, hour24, setTimeZone, setHour24, workdayStart, workdayEnd, setWorkday } = useTimePrefs()
  const [pushState, setPushState] = useState<SubscriptionState>('unsupported')
  const [loadingPush, setLoadingPush] = useState(false)

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
            {/* Theme picker */}
            <Box>
              <Typography variant="overline" color="text.secondary">Theme</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 1 }}>
                {THEMES.map((t) => {
                  const selected = t.key === selectedKey
                  const strip = [t.dark.primary, t.dark.secondary, ...t.dark.cat.slice(0, 3)]
                  return (
                    <Box
                      key={t.key}
                      component="button"
                      aria-label={t.label}
                      aria-pressed={selected}
                      onClick={() => setThemeKey(t.key)}
                      sx={{
                        textAlign: 'left', cursor: 'pointer', p: 1.5, borderRadius: 2,
                        border: 2, borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: 'background.paper', color: 'text.primary', font: 'inherit',
                        display: 'flex', flexDirection: 'column', gap: 0.75,
                        '&:hover': { borderColor: 'primary.light' },
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.mood}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        {strip.map((c, i) => (
                          <Box key={i} sx={{ width: 22, height: 14, borderRadius: 0.5, bgcolor: c }} />
                        ))}
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>

            {/* Mode selector */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                Mode
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

        {/* Date & Time section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="overline" sx={{ display: 'block', mb: 2, fontWeight: 600 }}>
            Date &amp; Time
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Clock format */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>Clock</Typography>
              <ToggleButtonGroup
                value={hour24 ? '24h' : '12h'}
                exclusive
                onChange={(_e, v) => { if (v !== null) setHour24(v === '24h') }}
              >
                <ToggleButton value="12h" aria-label="12-hour clock">12-hour</ToggleButton>
                <ToggleButton value="24h" aria-label="24-hour clock">24-hour</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {/* Timezone */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>Timezone</Typography>
              <TextField
                select
                size="small"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                slotProps={{ select: { native: true }, htmlInput: { 'aria-label': 'Timezone' } }}
                sx={{ minWidth: 240 }}
              >
                {COMMON_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.id === 'auto' ? `Auto (${effectiveZone('auto')})` : z.label}
                  </option>
                ))}
              </TextField>
            </Box>
            {/* Workday span (timeline) */}
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>Workday (timeline span)</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  select size="small" label="Start" value={workdayStart}
                  onChange={(e) => setWorkday(Math.min(Number(e.target.value), workdayEnd - 1), workdayEnd)}
                  slotProps={{ select: { native: true }, htmlInput: { 'aria-label': 'Workday start' } }} sx={{ minWidth: 110 }}
                >
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </TextField>
                <Typography variant="caption" color="text.secondary">to</Typography>
                <TextField
                  select size="small" label="End" value={workdayEnd}
                  onChange={(e) => setWorkday(workdayStart, Math.max(Number(e.target.value), workdayStart + 1))}
                  slotProps={{ select: { native: true }, htmlInput: { 'aria-label': 'Workday end' } }} sx={{ minWidth: 110 }}
                >
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </TextField>
              </Box>
            </Box>
            {/* Live preview */}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Preview: <span style={{ fontFamily: 'monospace' }}>{formatFriendly(new Date(), { timeZone, hour24 })}</span>
            </Typography>
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
