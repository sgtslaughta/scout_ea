import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

export interface ViewTab {
  id: string
  label: string
  element: ReactNode
}

export function TabbedView({ tabs, ariaLabel }: { tabs: ViewTab[]; ariaLabel: string }) {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const active = tabs.find((t) => t.id === requested) ?? tabs[0]

  const onChange = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next, { replace: true })
  }

  return (
    <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Tabs
        value={active.id}
        onChange={(_, v) => onChange(v)}
        aria-label={ariaLabel}
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40, flexShrink: 0 }}
      >
        {tabs.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} sx={{ minHeight: 40 }} />
        ))}
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Suspense fallback={null}>{active.element}</Suspense>
      </Box>
    </Box>
  )
}
