import { describe, it, expect } from 'vitest'
import { buildMuiTheme } from './factory'
import { getTheme } from './registry'

describe('buildMuiTheme', () => {
  it('maps a ThemeDef to both MUI color schemes', () => {
    const theme = buildMuiTheme(getTheme('cyberpunk'))
    expect(theme.colorSchemes.dark?.palette.primary.main).toBe('#ff2e88')
    expect(theme.colorSchemes.light?.palette.primary.main).toBe('#d6006e')
    expect(theme.colorSchemes.dark?.palette.background.default).toBe('#0a0612')
  })

  it('enables class-based css variables', () => {
    const theme = buildMuiTheme(getTheme('vscode'))
    expect(theme.colorSchemeSelector).toBe('class')
  })
})
