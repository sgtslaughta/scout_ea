import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import { Plus, Sun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning } from 'lucide-react'
import { getWeather, getFinance, type ForecastDay } from '@/api'
import { useWeatherLocation } from '@/lib/useWeatherLocation'
import { FinanceStrip } from '@/components/finance/FinanceStrip'
import { TimerPills } from '@/components/quickdraw/TimerPills'
import { TimersDrawer } from '@/components/quickdraw/TimersDrawer'
import { useQuickLinks } from './useQuickLinks'
import { QuickLinkTile } from './QuickLinkTile'
import { QuickLinksOverflow } from './QuickLinksOverflow'
import { QuickLinkEditorDialog } from './QuickLinkEditorDialog'
import { WeatherPopover } from './WeatherPopover'
import { DRAWERS } from './drawerRegistry'
import type { DrawerDef } from './drawerRegistry'

// Mirrors WeatherBand's condition->icon mapping (not exported from there —
// that component is coupled to the sky FX stack being deleted separately;
// this bar needs its own compact, theme-token-only readout instead).
export const CONDITION_ICON: Record<ForecastDay['condition'], typeof Sun> = {
  clear: Sun, clouds: Cloud, rain: CloudRain, snow: CloudSnow, fog: CloudFog, storm: CloudLightning,
}

function CompactWeather() {
  const loc = useWeatherLocation(true)
  const { data: weather } = useQuery({
    queryKey: ['weather', loc?.lat, loc?.lon],
    queryFn: () => getWeather(loc!.lat, loc!.lon),
    enabled: !!loc,
  })

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  // The popover paper is portaled outside this trigger, so a mouseLeave on
  // the trigger can't tell whether the pointer landed on the paper or left
  // for good — close on a short delay, cancelled by the paper's onMouseEnter.
  // Mirrors FinanceStrip's TickerPopover close-timer pattern.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  useEffect(() => clearCloseTimer, [])
  const scheduleClose = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setAnchorEl(null), 120)
  }

  if (!weather || weather.error || !weather.condition) return null

  const Icon = CONDITION_ICON[weather.condition]
  const unit = weather.unit || 'C'
  // No forecast data (e.g. still loading, or the API had nothing to give) —
  // degrade to the plain readout rather than offering a popover with nothing in it.
  const hasForecast = !!weather.forecast && weather.forecast.length > 0

  const openAt = (el: HTMLElement) => { clearCloseTimer(); setAnchorEl(el) }

  return (
    <>
      <Box
        role={hasForecast ? 'button' : undefined}
        tabIndex={hasForecast ? 0 : undefined}
        aria-label={hasForecast ? 'Weather forecast' : undefined}
        aria-haspopup={hasForecast ? 'dialog' : undefined}
        aria-expanded={hasForecast ? !!anchorEl : undefined}
        onMouseEnter={hasForecast ? (e) => openAt(e.currentTarget) : undefined}
        onMouseLeave={hasForecast ? scheduleClose : undefined}
        onFocus={hasForecast ? (e) => openAt(e.currentTarget) : undefined}
        onBlur={hasForecast ? scheduleClose : undefined}
        onClick={hasForecast ? (e) => openAt(e.currentTarget) : undefined}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: hasForecast ? 'pointer' : 'default' }}
      >
        <Icon size={24} role="img" aria-label={weather.condition} />
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'text.primary',
          }}
        >
          {Math.round(weather.temp ?? 0)}°{unit}
        </Typography>
      </Box>
      {anchorEl && (
        <WeatherPopover
          weather={weather}
          label={loc?.label ?? 'Weather'}
          anchorEl={anchorEl}
          open
          onClose={() => setAnchorEl(null)}
          onPaperEnter={clearCloseTimer}
        />
      )}
    </>
  )
}

/**
 * How many quick links to show inline for a given top-bar width. Capped at 5
 * however wide the window gets — the rest live in the hover menu.
 *
 * Deliberately a function of the *bar* width, not of the links row: the row
 * sizes to its own content, so measuring it to decide its content is circular
 * and settles at zero.
 */
export const MAX_INLINE_LINKS = 5

export function inlineLinkCount(barWidth: number): number {
  // Not measured yet (first paint, or jsdom, which has no layout): assume there
  // is room, so the bar doesn't flash empty before the observer fires.
  if (barWidth <= 0) return MAX_INLINE_LINKS
  if (barWidth >= 1400) return MAX_INLINE_LINKS
  if (barWidth >= 1100) return 3
  if (barWidth >= 800) return 2
  if (barWidth >= 600) return 1
  return 0
}

export interface TopBarProps {
  onOpenDrawer: (id: DrawerDef['id']) => void
}

export function TopBar({ onOpenDrawer }: TopBarProps) {
  const { links, addLink, editLink, removeLink } = useQuickLinks()
  const [editorOpen, setEditorOpen] = useState(false)
  const [timersOpen, setTimersOpen] = useState(false)

  const { data: finance } = useQuery({ queryKey: ['finance'], queryFn: getFinance })

  // Watch the bar itself, not the links row — see inlineLinkCount.
  const barRef = useRef<HTMLDivElement>(null)
  const [barWidth, setBarWidth] = useState(0)

  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const measure = () => setBarWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const visibleCount = inlineLinkCount(barWidth)
  const visible = links.slice(0, visibleCount)
  const overflow = links.slice(visibleCount)

  return (
    <Box
      component="header"
      ref={barRef}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <CompactWeather />

      <Box
        sx={{
          // Sizes to its content — at most 5 links plus the overflow chip and
          // add button — so no dead gap opens between them and the ticker.
          flex: '0 1 auto', minWidth: 0,
          display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden',
        }}
      >
        {visible.map((link) => <QuickLinkTile key={link.name} link={link} />)}
        <QuickLinksOverflow links={overflow} />

        {/* Sits right after the links so there's no dead gap. fitCount always
            reserves its width, so it can never be clipped out of reach. */}
        <Tooltip title="Add a quick link">
          <IconButton aria-label="Add a quick link" onClick={() => setEditorOpen(true)} sx={{ flexShrink: 0 }}>
            <Plus size={22} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Ticker absorbs whatever space is left, so nothing gaps. */}
      {finance && (
        <Box sx={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
          <FinanceStrip finance={finance} />
        </Box>
      )}

      <TimerPills onOpen={() => setTimersOpen(true)} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {DRAWERS.map((drawer) => {
          const Icon = drawer.icon
          return (
            <Tooltip title={drawer.label} key={drawer.id}>
              <IconButton aria-label={drawer.label} onClick={() => onOpenDrawer(drawer.id)}>
                <Icon size={22} />
              </IconButton>
            </Tooltip>
          )
        })}
      </Box>

      <QuickLinkEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        links={links}
        onAdd={addLink}
        onEdit={editLink}
        onRemove={removeLink}
      />
      <TimersDrawer open={timersOpen} onClose={() => setTimersOpen(false)} />
    </Box>
  )
}
