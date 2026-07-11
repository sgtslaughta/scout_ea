import type { ThemeDef } from './types'

export const vscode: ThemeDef = {
  key: 'vscode',
  label: 'VSCode / Win11 Fluent',
  mood: 'familiar tooling — quiet, professional',
  texture: 'mica',
  dark: {
    bg: '#1e1e1e', paper: '#252526', divider: '#333333',
    textPrimary: '#d4d4d4', textSecondary: '#858585',
    primary: '#3794ff', onPrimary: '#04121f', secondary: '#4ec9b0',
    error: '#f14c4c', warning: '#cca700', success: '#89d185', info: '#3794ff',
    cat: ['#3794ff', '#4ec9b0', '#dd9a5f', '#d4c96a', '#c586c0'],
  },
  light: {
    bg: '#f3f3f3', paper: '#ffffff', divider: '#e5e5e5',
    textPrimary: '#1f1f1f', textSecondary: '#616161',
    primary: '#005fb8', onPrimary: '#ffffff', secondary: '#007a6e',
    error: '#d13438', warning: '#9d5d00', success: '#107c10', info: '#005fb8',
    cat: ['#005fb8', '#c0491a', '#0e7a6b', '#8764b8', '#107c10'],
  },
}
