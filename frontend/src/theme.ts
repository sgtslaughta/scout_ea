// Compatibility shim: the default MUI theme, for tests and any legacy import.
// The live app builds themes via themes/ (ThemeSelectionProvider). Accent
// personalization is retired — the theme picker replaces it.
import { buildMuiTheme } from './themes/factory'
import { getTheme, DEFAULT_THEME_KEY } from './themes/registry'

export const theme = buildMuiTheme(getTheme(DEFAULT_THEME_KEY))
