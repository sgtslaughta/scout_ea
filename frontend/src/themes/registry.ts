import type { ThemeDef } from './types'
import { vscode } from './vscode'
import { cyberpunk } from './cyberpunk'
import { monokai } from './monokai'
import { forest } from './forest'
import { vibrant } from './vibrant'

// Registry order = picker order. Adding a theme = one file + one entry here.
export const THEMES: ThemeDef[] = [vscode, cyberpunk, monokai, forest, vibrant]

export const DEFAULT_THEME_KEY = 'vscode'

export function getTheme(key: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.key === key) ?? THEMES[0]
}
