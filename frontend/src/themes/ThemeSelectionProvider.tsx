import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider, useColorScheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { THEMES, getTheme, DEFAULT_THEME_KEY } from './registry'
import { buildMuiTheme } from './factory'
import { applyThemeVars } from './applyThemeVars'

const KEY = 'ea-theme-name'

interface Selection {
  selectedKey: string
  setThemeKey: (key: string) => void
}

const Ctx = createContext<Selection>({ selectedKey: DEFAULT_THEME_KEY, setThemeKey: () => {} })

export function useThemeSelection(): Selection {
  return useContext(Ctx)
}

// Pushes CSS vars whenever the active theme or resolved mode changes.
function ThemeVarsSync({ selectedKey }: { selectedKey: string }) {
  const { mode, systemMode } = useColorScheme()
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'dark'
  useEffect(() => {
    applyThemeVars(getTheme(selectedKey), resolved === 'light' ? 'light' : 'dark')
  }, [selectedKey, resolved])
  return null
}

export default function ThemeSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedKey, setSelectedKey] = useState<string>(
    () => getTheme(localStorage.getItem(KEY)).key,
  )
  const setThemeKey = (key: string) => {
    const resolved = getTheme(key).key
    setSelectedKey(resolved)
    localStorage.setItem(KEY, resolved)
  }
  const muiTheme = useMemo(() => buildMuiTheme(getTheme(selectedKey)), [selectedKey])

  return (
    <Ctx.Provider value={{ selectedKey, setThemeKey }}>
      <ThemeProvider theme={muiTheme} defaultMode="system" modeStorageKey="ea-theme">
        <CssBaseline />
        <ThemeVarsSync selectedKey={selectedKey} />
        {children}
      </ThemeProvider>
    </Ctx.Provider>
  )
}

// re-export so consumers can enumerate themes for the picker
export { THEMES }
