import { useEffect, useRef, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  Box,
  Typography,
  Stack,
  Paper,
  IconButton,
  Skeleton,
  alpha,
} from '@mui/material'
import { X } from 'lucide-react'
import { getBriefing, getWeather, getFinance } from '@/api'
import { WeatherBand } from './weather/WeatherBand'
import { SkyBackdrop } from './weather/SkyBackdrop'
import { skyPhase } from './weather/sky'
import { FinanceStrip } from './finance/FinanceStrip'
import { RankedItem } from './briefing/RankedItem'
import { useWeatherLocation } from '@/lib/useWeatherLocation'

const fmtCountdown = (s?: number): string | undefined => {
  if (s == null) return undefined
  if (s <= 0) return 'overdue'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `due in ${h}h ${m}m` : `due in ${m}m`
}

const SubLabel = ({ text }: { text: string }) => (
  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
    color: 'text.disabled', letterSpacing: 0.5, mt: 0.75, ml: 1 }}>{text}</Typography>
)

function Section({ title, empty, emptyText, children }:
  { title: string; empty: boolean; emptyText: string; children: ReactNode }) {
  return (
    <Paper
      sx={(theme) => ({
        p: 2,
        // Translucent so the sky reads through; blur keeps text contrast.
        backgroundColor: alpha(theme.palette.background.paper, 0.72),
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: 'divider',
      })}
    >
      <Typography variant="overline" sx={{ fontWeight: 700, display: 'block', mb: 1, color: 'text.secondary' }}>
        {title}
      </Typography>
      {empty
        ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{emptyText}</Typography>
        : <Stack spacing={0.25}>{children}</Stack>}
    </Paper>
  )
}

interface TodayBriefingProps {
  open: boolean
  onClose: () => void
}

export function TodayBriefing({ open, onClose }: TodayBriefingProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  const { data: briefing, isLoading } = useQuery({
    queryKey: ['briefing'],
    queryFn: getBriefing,
    enabled: open,
  })

  const loc = useWeatherLocation(open)
  const { data: weather } = useQuery({
    queryKey: ['weather', loc?.lat, loc?.lon],
    queryFn: () => getWeather(loc!.lat, loc!.lon),
    enabled: open && !!loc,
  })

  const { data: finance } = useQuery({
    queryKey: ['finance'],
    queryFn: getFinance,
    enabled: open,
  })

  // Sky phase drives the whole modal background, not just the weather band.
  const phase = weather?.sunrise && weather?.sunset
    ? skyPhase(new Date(), weather.sunrise, weather.sunset)
    : 'day'

  const go = (view: string) => {
    onClose()
    navigate(view)
  }

  // Focus close button when modal opens
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth slotProps={{ paper: { sx: { position: 'relative', height: '92vh', m: 'auto' } } }}>
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', position: 'relative' }}>
        <SkyBackdrop phase={phase} fade />
        {/* Close button */}
        <IconButton
          ref={closeButtonRef}
          onClick={onClose}
          sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
          aria-label="Close briefing"
        >
          <X size={20} />
        </IconButton>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {/* Weather band */}
          {weather ? <Box sx={{ mb: 2 }}><WeatherBand weather={weather} /></Box> : <Box sx={{ height: 120, mb: 2 }} />}

          {/* Finance strip — horizontal, directly below weather */}
          {finance && <Box sx={{ mb: 3 }}><FinanceStrip finance={finance} /></Box>}

          {isLoading ? (
            <Stack spacing={2}>
              <Skeleton variant="text" height={40} />
              <Skeleton variant="rounded" height={200} />
              <Skeleton variant="rounded" height={200} />
            </Stack>
          ) : (
            <>
              {/* Summary headline */}
              {briefing?.summary && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {briefing.summary}
                  </Typography>
                </Box>
              )}

              {/* Grid of 4 section cards — ranked, scored, with context */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
                {/* Critical */}
                <Section title="Critical" empty={!briefing?.critical?.length}
                  emptyText="No critical items — clear morning">
                  {briefing?.critical?.map((item) => (
                    <RankedItem key={`c-${item.id}`} rank={item.rank ?? 0} title={item.title}
                      score={item.score} subtitle={item.summary || item.detail}
                      meta={item.kind === 'deadline' ? fmtCountdown(item.countdown_seconds) : undefined}
                      onClick={() => item.nav && go(item.nav.view)} />
                  ))}
                </Section>

                {/* Risks & Opportunities */}
                <Section title="Risks & Opportunities"
                  empty={!briefing?.risks?.length && !briefing?.opportunities?.length}
                  emptyText="Nothing flagged">
                  {!!briefing?.risks?.length && <SubLabel text="Risks" />}
                  {briefing?.risks?.map((s) => (
                    <RankedItem key={`r-${s.id}`} rank={s.rank ?? 0} title={s.title}
                      score={s.score} subtitle={s.summary} onClick={() => go('/feed')} />
                  ))}
                  {!!briefing?.opportunities?.length && <SubLabel text="Opportunities" />}
                  {briefing?.opportunities?.map((s) => (
                    <RankedItem key={`o-${s.id}`} rank={s.rank ?? 0} title={s.title}
                      score={s.score} subtitle={s.summary} onClick={() => go('/feed')} />
                  ))}
                </Section>

                {/* Topics News */}
                <Section title="Topics News" empty={!briefing?.news_by_topic?.length}
                  emptyText="No topics today">
                  {briefing?.news_by_topic?.map((topic) => (
                    <Box key={topic.topic_id}>
                      <SubLabel text={topic.topic_name} />
                      {topic.items?.map((item) => (
                        <RankedItem key={`n-${item.id}`} rank={item.rank ?? 0} title={item.title}
                          score={item.score} subtitle={item.synopsis} onClick={() => go('/feed')} />
                      ))}
                    </Box>
                  ))}
                </Section>

                {/* Key People */}
                <Section title="Key People" empty={!briefing?.people?.length}
                  emptyText="No key people">
                  {briefing?.people?.map((p) => (
                    <RankedItem key={`p-${p.id}`} rank={p.rank ?? 0} title={p.name} score={p.score}
                      subtitle={p.notes} meta={[p.role, p.org].filter(Boolean).join(' · ') || undefined}
                      onClick={() => go('/people')} />
                  ))}
                </Section>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  )
}
