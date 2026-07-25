import type { ReactNode } from 'react'
import { Box, Typography, Stack, Paper, alpha } from '@mui/material'
import type { BriefingResponse } from '@/api'
import { RankedItem } from './RankedItem'

const fmtCountdown = (s?: number): string | undefined => {
  if (s == null) return undefined
  if (s <= 0) return 'overdue'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `due in ${h}h ${m}m` : `due in ${m}m`
}

// Signal.created_at is the only reliably-declared timestamp among the row
// types wired here (CriticalItem's due_at is deadline/task-specific).
const fmtTimestamp = (iso?: string): string | undefined =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : undefined

const SubLabel = ({ text }: { text: string }) => (
  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
    color: 'text.disabled', letterSpacing: 0.5, mt: 0.75, ml: 1 }}>{text}</Typography>
)

function Section({ title, empty, emptyText, children }:
  { title: string; empty: boolean; emptyText: string; children: ReactNode }) {
  return (
    <Paper
      data-testid="briefing-section"
      sx={(theme) => ({
        p: 2,
        // Translucent so the sky reads through; blur keeps text contrast.
        // theme.vars is only populated under cssVariables (enabled for this app);
        // fall back to alpha() for callers/tests without the CSS-vars ThemeProvider.
        backgroundColor: theme.vars
          ? `rgba(${theme.vars.palette.background.paperChannel} / 0.72)`
          : alpha(theme.palette.background.paper, 0.72),
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

export interface BriefingSectionsProps {
  briefing: BriefingResponse | undefined
  onNavigate: (view: string) => void
}

export function BriefingSections({ briefing, onNavigate }: BriefingSectionsProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
      {/* Critical */}
      <Section title="Critical" empty={!briefing?.critical?.length}
        emptyText="No critical items — clear morning">
        {briefing?.critical?.map((item) => (
          <RankedItem key={`c-${item.id}`} rank={item.rank ?? 0} title={item.title}
            score={item.score} scoreReason={item.score_reason}
            subtitle={item.summary || item.detail} detail={item.detail || item.summary}
            why={item.kind === 'signal' ? item.why : undefined}
            meta={item.kind === 'deadline' ? fmtCountdown(item.countdown_seconds) : undefined}
            onClick={() => item.nav && onNavigate(item.nav.view)} />
        ))}
      </Section>

      {/* Risks & Opportunities */}
      <Section title="Risks & Opportunities"
        empty={!briefing?.risks?.length && !briefing?.opportunities?.length}
        emptyText="Nothing flagged">
        {!!briefing?.risks?.length && <SubLabel text="Risks" />}
        {briefing?.risks?.map((s) => (
          <RankedItem key={`r-${s.id}`} rank={s.rank ?? 0} title={s.title}
            score={s.score} scoreReason={s.score_reason}
            subtitle={s.summary} detail={s.summary} why={s.why} timestamp={fmtTimestamp(s.created_at)}
            onClick={() => onNavigate('/feed')} />
        ))}
        {!!briefing?.opportunities?.length && <SubLabel text="Opportunities" />}
        {briefing?.opportunities?.map((s) => (
          <RankedItem key={`o-${s.id}`} rank={s.rank ?? 0} title={s.title}
            score={s.score} scoreReason={s.score_reason}
            subtitle={s.summary} detail={s.summary} why={s.why} timestamp={fmtTimestamp(s.created_at)}
            onClick={() => onNavigate('/feed')} />
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
                score={item.score} scoreReason={item.score_reason}
                subtitle={item.synopsis} detail={item.synopsis} onClick={() => onNavigate('/feed')} />
            ))}
          </Box>
        ))}
      </Section>

      {/* Key People */}
      <Section title="Key People" empty={!briefing?.people?.length}
        emptyText="No key people">
        {briefing?.people?.map((p) => (
          <RankedItem key={`p-${p.id}`} rank={p.rank ?? 0} title={p.name} score={p.score}
            scoreReason={p.score_reason}
            subtitle={p.notes} detail={p.notes} meta={[p.role, p.org].filter(Boolean).join(' · ') || undefined}
            onClick={() => onNavigate('/people')} />
        ))}
      </Section>
    </Box>
  )
}
