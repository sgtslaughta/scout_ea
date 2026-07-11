import { describe, it, expect } from 'vitest'
import { THEMES, DEFAULT_THEME_KEY, getTheme } from './registry'

const HEX = /^#[0-9a-f]{6}$/i

describe('theme registry', () => {
  it('has 5 themes with unique keys, vscode first (default)', () => {
    expect(THEMES).toHaveLength(5)
    const keys = THEMES.map((t) => t.key)
    expect(new Set(keys).size).toBe(5)
    expect(THEMES[0].key).toBe(DEFAULT_THEME_KEY)
    expect(DEFAULT_THEME_KEY).toBe('vscode')
  })

  it('every theme is fully populated in both modes', () => {
    const TEX = ['mica', 'scanlines', 'vignette', 'grain', 'dots']
    for (const t of THEMES) {
      expect(t.label).toBeTruthy()
      expect(t.mood).toBeTruthy()
      expect(TEX).toContain(t.texture)
      for (const mode of [t.dark, t.light]) {
        expect(mode.cat).toHaveLength(5)
        for (const c of [mode.bg, mode.paper, mode.primary, mode.secondary, ...mode.cat]) {
          expect(c).toMatch(HEX)
        }
      }
    }
  })

  it('getTheme falls back to default for unknown/empty keys', () => {
    expect(getTheme('nope').key).toBe('vscode')
    expect(getTheme(null).key).toBe('vscode')
    expect(getTheme('cyberpunk').key).toBe('cyberpunk')
  })
})
