import { useState, useCallback } from 'react'

const EXPANDED_KEY = 'ea-quickdraw-expanded'
const COLLAPSED_KEY = 'ea-quickdraw-collapsed'

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch { return new Set() }
}

export function useQuickdrawPrefs() {
  const [expanded, setExpanded] = useState(() => localStorage.getItem(EXPANDED_KEY) === '1')
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed)

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const toggleSection = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed])

  return { expanded, toggleExpanded, isCollapsed, toggleSection }
}
