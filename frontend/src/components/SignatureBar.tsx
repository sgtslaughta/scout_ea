import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'
import { Sun, Moon, Sparkles } from 'lucide-react'

interface SignatureBarProps {
  onCommandOpen?: () => void
  onOpenBriefing?: () => void
}

const HOURS = [7, 9, 11, 13, 15, 17]

export function SignatureBar({ onCommandOpen, onOpenBriefing }: SignatureBarProps) {
  const [time, setTime] = useState(new Date())
  const { mode, systemMode, setMode } = useColorScheme()
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'dark'

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const totalMinutes = time.getHours() * 60 + time.getMinutes()
  const positionPercent = Math.max(0, Math.min(100, ((totalMinutes - 7 * 60) / (11 * 60)) * 100))

  return (
    <Box
      sx={{
        height: 48, display: 'flex', alignItems: 'center', px: 2, gap: 1.5,
        bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
      }}
    >
      <Typography variant="h6" sx={{ fontSize: 18, mr: 1 }}>SCOUT</Typography>
      <Box sx={{ position: 'relative', flex: 1, height: 32 }}>
        <Box
          data-horizon
          sx={{
            position: 'absolute', left: 0, right: 0, top: '50%', height: 3, borderRadius: 1,
            background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-2))',
          }}
        />
        <Box sx={{ position: 'absolute', transform: 'translateX(-50%)', left: `${positionPercent}%`, top: 'calc(50% - 9px)' }}>
          <Box
            sx={{
              width: 0, height: 0,
              borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
              borderBottom: '10px solid var(--color-accent)',
              filter: 'drop-shadow(0 0 4px var(--color-accent))',
              '@media (prefers-reduced-motion: no-preference)': { animation: 'pulse 2s infinite' },
              '@keyframes pulse': { '0%, 100%': { opacity: 0.8 }, '50%': { opacity: 1 } },
            }}
          />
        </Box>
        {HOURS.map((h) => (
          <Typography
            key={h}
            sx={{ position: 'absolute', left: `${((h - 7) / 11) * 100}%`, top: '100%', fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: 'text.secondary' }}
          >
            {h > 12 ? `${h - 12}p` : `${h}a`}
          </Typography>
        ))}
      </Box>
      <IconButton size="small" onClick={onOpenBriefing} aria-label="Open today briefing">
        <Sparkles size={16} />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}
        aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </IconButton>
      <Button size="small" variant="outlined" onClick={onCommandOpen} aria-label="Open command palette" sx={{ minWidth: 0, px: 1, fontSize: 11 }}>
        ⌘K
      </Button>
    </Box>
  )
}
