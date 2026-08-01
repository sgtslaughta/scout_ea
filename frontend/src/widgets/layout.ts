export const LAYOUT_KEY = 'ea-dashboard-layout'

export interface DashboardLayout {
  order: string[]
  hidden: string[]
}

export function defaultLayout(allKeys: string[]): DashboardLayout {
  return { order: [...allKeys], hidden: [] }
}

export function loadLayout(allKeys: string[]): DashboardLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return defaultLayout(allKeys)
    const parsed = JSON.parse(raw) as DashboardLayout
    const known = new Set(allKeys)
    const order = parsed.order.filter((k) => known.has(k))
    for (const k of allKeys) if (!order.includes(k)) order.push(k)
    const hidden = [...new Set(parsed.hidden)].filter((k) => known.has(k))
    return { order, hidden }
  } catch {
    return defaultLayout(allKeys)
  }
}

export function saveLayout(layout: DashboardLayout): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}

export function reorderWidgets(
  layout: DashboardLayout,
  activeKey: string,
  overKey: string,
): DashboardLayout {
  if (activeKey === overKey) return layout
  const from = layout.order.indexOf(activeKey)
  const to = layout.order.indexOf(overKey)
  if (from < 0 || to < 0) return layout
  const order = [...layout.order]
  order.splice(from, 1)
  order.splice(to, 0, activeKey)
  return { ...layout, order }
}

export function setWidgetHidden(layout: DashboardLayout, key: string, hidden: boolean): DashboardLayout {
  const set = new Set(layout.hidden)
  if (hidden) set.add(key)
  else set.delete(key)
  return { ...layout, hidden: [...set] }
}
