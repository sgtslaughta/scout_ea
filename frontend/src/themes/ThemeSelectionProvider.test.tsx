import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { applyThemeVars } from './applyThemeVars'
import { getTheme } from './registry'
import ThemeSelectionProvider, { useThemeSelection } from './ThemeSelectionProvider'

function Probe() {
  const { selectedKey, setThemeKey } = useThemeSelection()
  return (
    <div>
      <span data-testid="key">{selectedKey}</span>
      <button onClick={() => setThemeKey('cyberpunk')}>go cyber</button>
    </div>
  )
}

describe('applyThemeVars', () => {
  beforeEach(() => { document.documentElement.style.cssText = ''; delete document.documentElement.dataset.themeTexture })
  it('writes accent, chart vars, and texture attr for the resolved mode', () => {
    applyThemeVars(getTheme('cyberpunk'), 'dark')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--color-accent')).toBe('#ff2e88')
    expect(root.style.getPropertyValue('--chart-1')).toBe('#ff2e88')
    expect(root.style.getPropertyValue('--chart-5')).toBe('#39ff9e')
    expect(root.dataset.themeTexture).toBe('scanlines')
  })
  it('applies light-mode vars correctly', () => {
    applyThemeVars(getTheme('cyberpunk'), 'light')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--color-accent')).toBe('#d6006e')
    expect(root.style.getPropertyValue('--chart-1')).toBe('#d6006e')
  })
})

describe('ThemeSelectionProvider', () => {
  beforeEach(() => localStorage.clear())
  it('defaults to vscode and persists a change to ea-theme-name', () => {
    render(<ThemeSelectionProvider><Probe /></ThemeSelectionProvider>)
    expect(screen.getByTestId('key')).toHaveTextContent('vscode')
    fireEvent.click(screen.getByRole('button', { name: /go cyber/i }))
    expect(screen.getByTestId('key')).toHaveTextContent('cyberpunk')
    expect(localStorage.getItem('ea-theme-name')).toBe('cyberpunk')
  })

  it('restores the stored theme on mount', () => {
    localStorage.setItem('ea-theme-name', 'monokai')
    render(<ThemeSelectionProvider><Probe /></ThemeSelectionProvider>)
    expect(screen.getByTestId('key')).toHaveTextContent('monokai')
  })

  it('falls back to default when localStorage has an unknown key', () => {
    localStorage.setItem('ea-theme-name', 'garbage_key')
    render(<ThemeSelectionProvider><Probe /></ThemeSelectionProvider>)
    expect(screen.getByTestId('key')).toHaveTextContent('vscode')
  })
})
