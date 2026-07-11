import type { ThemeDef } from './types'

export const forest: ThemeDef = {
  key: 'forest',
  label: 'Forest Earthy',
  mood: 'calm & organic — sage + terracotta, grounded',
  texture: 'grain',
  dark: {
    bg: '#10150f', paper: '#191f16', divider: '#262e20',
    textPrimary: '#e9ede3', textSecondary: '#9aa890',
    primary: '#86bf6b', onPrimary: '#0e1a0a', secondary: '#e0925b',
    error: '#d9705e', warning: '#e0b24a', success: '#86bf6b', info: '#6fb0a0',
    cat: ['#7dbf5f', '#31b39a', '#e0b23a', '#e07a45', '#b579b0'],
  },
  light: {
    bg: '#f5f7ef', paper: '#ffffff', divider: '#e1e6d5',
    textPrimary: '#1b2415', textSecondary: '#5c6650',
    primary: '#47762c', onPrimary: '#ffffff', secondary: '#b5652a',
    error: '#b8402e', warning: '#9a7318', success: '#47762c', info: '#2f7d70',
    cat: ['#3f7a2c', '#b8461c', '#0e7a6b', '#7d4a7a', '#8a6a10'],
  },
}
