// Tag palette keys → theme-driven CSS var swatches. Stored keys stay theme-independent;
// the vars (pushed by ThemeSelectionProvider) resolve per active theme + mode.
export type TagColorKey = 'neutral' | 'red' | 'amber' | 'green' | 'teal' | 'blue' | 'violet' | 'pink'
interface Swatch { bg: string; fg: string }

export const TAG_COLORS: Record<TagColorKey, Swatch> = {
  neutral: { bg: 'var(--mui-palette-action-selected)', fg: 'var(--mui-palette-text-primary)' },
  red:     { bg: 'var(--mui-palette-error-main)',      fg: '#fff' },
  amber:   { bg: 'var(--mui-palette-warning-main)',    fg: '#000' },
  green:   { bg: 'var(--mui-palette-success-main)',    fg: '#fff' },
  teal:    { bg: 'var(--chart-3, var(--color-accent))',   fg: '#fff' },
  blue:    { bg: 'var(--chart-1, var(--color-accent))',   fg: '#fff' },
  violet:  { bg: 'var(--chart-5, var(--color-accent-2))', fg: '#fff' },
  pink:    { bg: 'var(--chart-4, var(--color-accent-2))', fg: '#fff' },
}

export const colorOf = (key: string): Swatch => TAG_COLORS[key as TagColorKey] ?? TAG_COLORS.neutral
export const COLOR_KEYS = Object.keys(TAG_COLORS) as TagColorKey[]
