export type ThemeMode = 'dark' | 'light' | 'system'

const MQ = '(prefers-color-scheme: dark)'

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia(MQ).matches ? 'dark' : 'light'
  }
  return mode
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
  document.documentElement.classList.toggle('light', resolved === 'light')
}

export function getStoredMode(): ThemeMode {
  return (localStorage.getItem('ea-theme') as ThemeMode) || 'system'
}

export function setStoredMode(mode: ThemeMode) {
  localStorage.setItem('ea-theme', mode)
  applyTheme(mode)
}
