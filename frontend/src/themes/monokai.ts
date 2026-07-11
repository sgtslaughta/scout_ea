import type { ThemeDef } from './types'

export const monokai: ThemeDef = {
  key: 'monokai',
  label: 'Dark Monokai',
  mood: 'the editor classic — pink/green/cyan on warm charcoal',
  texture: 'vignette',
  dark: {
    bg: '#22231e', paper: '#2c2d26', divider: '#3a3b32',
    textPrimary: '#f8f8f2', textSecondary: '#a59f8a',
    primary: '#f92672', onPrimary: '#1a0410', secondary: '#66d9ef',
    error: '#f92672', warning: '#fd971f', success: '#a6e22e', info: '#66d9ef',
    cat: ['#f92672', '#a6e22e', '#66d9ef', '#ae81ff', '#fd971f'],
  },
  light: {
    bg: '#fafaf5', paper: '#ffffff', divider: '#e8e6d8',
    textPrimary: '#272822', textSecondary: '#6a6550',
    primary: '#d81b60', onPrimary: '#ffffff', secondary: '#0089a6',
    error: '#d81b60', warning: '#c46a10', success: '#6a9c11', info: '#0089a6',
    cat: ['#d81b60', '#6a9c11', '#0089a6', '#8b52d6', '#c46a10'],
  },
}
