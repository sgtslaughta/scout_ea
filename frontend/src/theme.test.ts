import { describe, it, expect, beforeEach } from 'vitest'
import { theme, applyAccent, loadAccent, ACCENT_KEY } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.cssText = ''
  })

  it('has light and dark color schemes with brand palette', () => {
    expect(theme.colorSchemes.dark?.palette.primary.main).toBe('#F2A65A')
    expect(theme.colorSchemes.light?.palette.primary.main).toBe('#E67E22')
    expect(theme.colorSchemes.dark?.palette.background.default).toBe('#0B1220')
    expect(theme.colorSchemes.light?.palette.background.paper).toBe('#FFFFFF')
  })

  it('uses class-based color scheme selector (matches Tailwind tokens)', () => {
    expect(theme.cssVariables).toMatchObject({ colorSchemeSelector: 'class' })
  })

  it('applyAccent persists and sets both CSS var systems', () => {
    applyAccent('#FF0000')
    expect(localStorage.getItem(ACCENT_KEY)).toBe('#FF0000')
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#FF0000')
    expect(document.documentElement.style.getPropertyValue('--mui-palette-primary-main')).toBe('#FF0000')
  })

  it('loadAccent restores stored accent', () => {
    localStorage.setItem(ACCENT_KEY, '#00FF00')
    loadAccent()
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#00FF00')
  })

  it('loadAccent is a no-op when nothing stored', () => {
    loadAccent()
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('')
  })
})
