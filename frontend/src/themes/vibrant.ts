import type { ThemeDef } from './types'

export const vibrant: ThemeDef = {
  key: 'vibrant',
  label: 'Vibrant Playful',
  mood: 'fun & whimsical — coral + violet, higher energy',
  texture: 'dots',
  dark: {
    bg: '#17121e', paper: '#221a2c', divider: '#322842',
    textPrimary: '#f4effa', textSecondary: '#b3a6c6',
    primary: '#ff6b6b', onPrimary: '#2a0f0f', secondary: '#c084fc',
    error: '#ff6b6b', warning: '#fbbf24', success: '#34d399', info: '#60a5fa',
    cat: ['#ff6b6b', '#c084fc', '#2dd4bf', '#fbbf24', '#60a5fa'],
  },
  light: {
    bg: '#fdf5fa', paper: '#ffffff', divider: '#f0deec',
    textPrimary: '#2a1936', textSecondary: '#6e5a7e',
    primary: '#e0286e', onPrimary: '#ffffff', secondary: '#8b3fd6',
    error: '#d61f5c', warning: '#d97706', success: '#0e9f6e', info: '#2f6fd6',
    cat: ['#e0286e', '#8b3fd6', '#0d9488', '#d97706', '#2f6fd6'],
  },
}
