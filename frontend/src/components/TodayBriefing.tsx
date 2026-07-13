import { useEffect, useRef } from 'react'
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
  Tooltip,
} from '@mui/material'
import { X } from 'lucide-react'
import { getBriefing, getWeather, getFinance } from '@/api'
import { WeatherBand } from './weather/WeatherBand'
import { FinanceStrip } from './finance/FinanceStrip'
import { useWeatherLocation } from '@/lib/useWeatherLocation'

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
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Close button */}
        <IconButton
          ref={closeButtonRef}
          onClick={onClose}
          sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
          aria-label="Close briefing"
        >
          <X size={20} />
        </IconButton>

        {/* Weather band */}
        {weather ? <Box sx={{ mb: 3 }}><WeatherBand weather={weather} /></Box> : <Box sx={{ height: 120, mb: 3 }} />}

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

            {/* Grid of 4 section cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
              {/* Critical Section */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  CRITICAL
                </Typography>
                {briefing?.critical && briefing.critical.length > 0 ? (
                  <Stack spacing={1}>
                    {briefing.critical.map((item) => (
                      <Tooltip key={item.id} title={item.title} placement="right" arrow>
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={() => item.nav && go(item.nav.view)}
                          onKeyDown={(e) => e.key === 'Enter' && item.nav && go(item.nav.view)}
                          sx={{
                            p: 1,
                            borderRadius: 0.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.selected' },
                          }}
                        >
                          <Typography variant="body2">{item.title}</Typography>
                        </Box>
                      </Tooltip>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No critical items — clear morning
                  </Typography>
                )}
              </Paper>

              {/* Risks & Opportunities Section */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  RISKS & OPPORTUNITIES
                </Typography>
                {(briefing?.risks && briefing.risks.length > 0) || (briefing?.opportunities && briefing.opportunities.length > 0) ? (
                  <Stack spacing={1}>
                    {briefing?.risks?.map((item) => (
                      <Tooltip key={item.id} title={item.title} placement="right" arrow>
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={() => go('/feed')}
                          onKeyDown={(e) => e.key === 'Enter' && go('/feed')}
                          sx={{
                            p: 1,
                            borderRadius: 0.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.selected' },
                          }}
                        >
                          <Typography variant="body2">{item.title}</Typography>
                        </Box>
                      </Tooltip>
                    ))}
                    {briefing?.opportunities?.map((item) => (
                      <Tooltip key={item.id} title={item.title} placement="right" arrow>
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={() => go('/feed')}
                          onKeyDown={(e) => e.key === 'Enter' && go('/feed')}
                          sx={{
                            p: 1,
                            borderRadius: 0.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.selected' },
                          }}
                        >
                          <Typography variant="body2">{item.title}</Typography>
                        </Box>
                      </Tooltip>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Nothing flagged
                  </Typography>
                )}
              </Paper>

              {/* Topics News Section */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  TOPICS NEWS
                </Typography>
                {briefing?.news_by_topic && briefing.news_by_topic.length > 0 ? (
                  <Stack spacing={1}>
                    {briefing.news_by_topic.map((topic) =>
                      topic.items?.map((item) => (
                        <Tooltip key={item.id} title={item.title} placement="right" arrow>
                          <Box
                            role="button"
                            tabIndex={0}
                            onClick={() => go('/feed')}
                            onKeyDown={(e) => e.key === 'Enter' && go('/feed')}
                            sx={{
                              p: 1,
                              borderRadius: 0.5,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.selected' },
                            }}
                          >
                            <Typography variant="body2">{item.title}</Typography>
                          </Box>
                        </Tooltip>
                      ))
                    )}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No topics today
                  </Typography>
                )}
              </Paper>

              {/* Key People Section */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  KEY PEOPLE
                </Typography>
                {briefing?.people && briefing.people.length > 0 ? (
                  <Stack spacing={1}>
                    {briefing.people.map((person) => (
                      <Tooltip key={person.id} title={person.name} placement="right" arrow>
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={() => go('/people')}
                          onKeyDown={(e) => e.key === 'Enter' && go('/people')}
                          sx={{
                            p: 1,
                            borderRadius: 0.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.selected' },
                          }}
                        >
                          <Typography variant="body2">{person.name}</Typography>
                        </Box>
                      </Tooltip>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No key people
                  </Typography>
                )}
              </Paper>
            </Box>

            {/* Finance strip */}
            {finance ? <FinanceStrip finance={finance} /> : <Box sx={{ minHeight: 60 }} />}
          </>
        )}
      </Box>
    </Dialog>
  )
}
