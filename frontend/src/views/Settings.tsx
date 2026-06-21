import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { getStoredMode, setStoredMode, type ThemeMode } from '@/lib/theme'

const ACCENT_COLORS = [
  { name: 'Amber', hex: '#F2A65A' },
  { name: 'Indigo', hex: '#6C8FE5' },
  { name: 'Emerald', hex: '#3DD68C' },
  { name: 'Coral', hex: '#E5484D' },
  { name: 'Violet', hex: '#A78BFA' },
]

export function SettingsView() {
  const [currentAccent, setCurrentAccent] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ea-accent') || '#F2A65A'
    }
    return '#F2A65A'
  })
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getStoredMode())

  useEffect(() => {
    document.documentElement.style.setProperty('--color-accent', currentAccent)
    localStorage.setItem('ea-accent', currentAccent)
  }, [currentAccent])

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-6">
        <h1 className="text-display text-lg text-text">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Appearance section */}
        <div className="mb-8">
          <h2 className="text-display text-base text-text font-medium mb-4">
            Appearance
          </h2>

          <div className="space-y-4">
            {/* Accent color picker */}
            <div>
              <label className="text-sm text-muted block mb-3">Accent Color</label>
              <div className="flex gap-3">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => setCurrentAccent(color.hex)}
                    className="group relative"
                    title={color.name}
                  >
                    <div
                      className="w-12 h-12 rounded-lg border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color.hex,
                        borderColor:
                          currentAccent === color.hex
                            ? '#E6EDF7'
                            : '#243149',
                      }}
                    />
                    {currentAccent === color.hex && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check size={20} className="text-bg" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">
                Currently: <span className="font-mono">{currentAccent}</span>
              </p>
            </div>

            {/* Theme selector */}
            <div>
              <label className="text-sm text-muted block mb-3">Theme</label>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setCurrentTheme(mode)
                      setStoredMode(mode)
                    }}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      currentTheme === mode
                        ? 'bg-accent text-bg'
                        : 'bg-surface-2 text-text border border-border hover:border-accent'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">
                Currently: <span className="font-mono">{currentTheme}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
