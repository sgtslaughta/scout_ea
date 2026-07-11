import type { ThemeDef } from './types'

export function applyThemeVars(def: ThemeDef, resolvedMode: 'dark' | 'light'): void {
  const t = resolvedMode === 'light' ? def.light : def.dark
  const root = document.documentElement
  root.style.setProperty('--color-accent', t.primary)
  root.style.setProperty('--color-accent-2', t.secondary)
  t.cat.forEach((c, i) => root.style.setProperty(`--chart-${i + 1}`, c))
  root.dataset.themeTexture = def.texture
}
