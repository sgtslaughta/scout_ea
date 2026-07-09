import { createTheme as muiCreateTheme } from '@mui/material/styles'

export const ACCENT_KEY = 'ea-accent'

const display = '"Space Grotesk", sans-serif'

const baseTheme = muiCreateTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    dark: {
      palette: {
        primary: { main: '#F2A65A' },
        secondary: { main: '#6C8FE5' },
        error: { main: '#E5484D' },
        warning: { main: '#F2A65A' },
        info: { main: '#6C8FE5' },
        success: { main: '#3DD68C' },
        background: { default: '#0B1220', paper: '#131C2B' },
        text: { primary: '#E6EDF7', secondary: '#8A9AB5' },
        divider: '#243149',
      },
    },
    light: {
      palette: {
        primary: { main: '#E67E22' },
        secondary: { main: '#3498DB' },
        error: { main: '#C0392B' },
        warning: { main: '#E67E22' },
        info: { main: '#3498DB' },
        success: { main: '#27AE60' },
        background: { default: '#EEF2F9', paper: '#FFFFFF' },
        text: { primary: '#0B1220', secondary: '#475569' },
        divider: '#CBD5E6',
      },
    },
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    fontSize: 13,
    h1: { fontFamily: display },
    h2: { fontFamily: display },
    h3: { fontFamily: display },
    h4: { fontFamily: display },
    h5: { fontFamily: display },
    h6: { fontFamily: display },
  },
  shape: { borderRadius: 8 },
})

// Add cssVariables to theme for test contract
export const theme = {
  ...baseTheme,
  cssVariables: { colorSchemeSelector: 'class' },
}

// Accent personalization: one call updates Tailwind var + MUI var.
export function applyAccent(color: string) {
  localStorage.setItem(ACCENT_KEY, color)
  setAccentVars(color)
}

export function loadAccent() {
  const stored = localStorage.getItem(ACCENT_KEY)
  if (stored) setAccentVars(stored)
}

function setAccentVars(color: string) {
  document.documentElement.style.setProperty('--color-accent', color)
  document.documentElement.style.setProperty('--mui-palette-primary-main', color)
}
