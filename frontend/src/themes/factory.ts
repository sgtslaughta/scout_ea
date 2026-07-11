import { createTheme, type Theme } from '@mui/material/styles'
import type { ThemeDef, ThemeTokens } from './types'

const display = '"Space Grotesk", sans-serif'

function palette(t: ThemeTokens) {
  return {
    primary: { main: t.primary, contrastText: t.onPrimary },
    secondary: { main: t.secondary },
    error: { main: t.error },
    warning: { main: t.warning },
    info: { main: t.info },
    success: { main: t.success },
    background: { default: t.bg, paper: t.paper },
    text: { primary: t.textPrimary, secondary: t.textSecondary },
    divider: t.divider,
  }
}

export function buildMuiTheme(def: ThemeDef): Theme {
  return createTheme({
    cssVariables: { colorSchemeSelector: 'class' },
    colorSchemes: {
      dark: { palette: palette(def.dark) },
      light: { palette: palette(def.light) },
    },
    typography: {
      fontFamily: '"Inter", sans-serif',
      fontSize: 13,
      h1: { fontFamily: display }, h2: { fontFamily: display },
      h3: { fontFamily: display }, h4: { fontFamily: display },
      h5: { fontFamily: display }, h6: { fontFamily: display },
    },
    shape: { borderRadius: 8 },
  })
}
