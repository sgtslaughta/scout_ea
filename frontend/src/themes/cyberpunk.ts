import type { ThemeDef } from './types'

export const cyberpunk: ThemeDef = {
  key: 'cyberpunk',
  label: 'Cyberpunk',
  mood: 'neon night city — magenta + cyan, max contrast',
  texture: 'scanlines',
  dark: {
    bg: '#0a0612', paper: '#140a1f', divider: '#2a1740',
    textPrimary: '#f0e6ff', textSecondary: '#9a7fb8',
    primary: '#ff2e88', onPrimary: '#12000a', secondary: '#00e5ff',
    error: '#ff3860', warning: '#ffb000', success: '#39ff9e', info: '#00e5ff',
    cat: ['#ff2e88', '#00e5ff', '#b14aff', '#ffdd00', '#39ff9e'],
  },
  light: {
    bg: '#f6f0fb', paper: '#ffffff', divider: '#ece0f5',
    textPrimary: '#1a0b26', textSecondary: '#6e5a80',
    primary: '#d6006e', onPrimary: '#ffffff', secondary: '#0088a8',
    error: '#e0114f', warning: '#c77b00', success: '#0a9d5a', info: '#0088a8',
    cat: ['#d6006e', '#0088a8', '#8b2fd6', '#b58900', '#0a9d5a'],
  },
}
