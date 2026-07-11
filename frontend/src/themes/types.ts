export type TextureId = 'mica' | 'scanlines' | 'vignette' | 'grain' | 'dots'

export interface ThemeTokens {
  bg: string
  paper: string
  divider: string
  textPrimary: string
  textSecondary: string
  primary: string
  onPrimary: string
  secondary: string
  error: string
  warning: string
  success: string
  info: string
  cat: [string, string, string, string, string]
}

export interface ThemeDef {
  key: string
  label: string
  mood: string
  texture: TextureId
  dark: ThemeTokens
  light: ThemeTokens
}
