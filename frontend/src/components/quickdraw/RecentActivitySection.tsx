import { useQuery } from '@tanstack/react-query'
import { Stack } from '@mui/material'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { getActivity } from '@/api'
import { useFriendlyTime } from '@/lib/timePrefs'
import { QuickdrawSection } from './QuickdrawSection'
import { QuickdrawItem } from './QuickdrawItem'

export function RecentActivitySection({ collapsed, onToggle }: { collapsed: boolean; onToggle: (id: string) => void }) {
  const friendly = useFriendlyTime()
  const activityQ = useQuery({ queryKey: ['activity', 'recent'], queryFn: () => getActivity(10), refetchInterval: 15000 })
  const rows = activityQ.data ?? []

  return (
    <QuickdrawSection
      id="recent" label="Recent Activity" count={rows.length} collapsed={collapsed} onToggle={onToggle}
      loading={activityQ.isLoading} error={!!activityQ.error} empty="No tracks yet."
    >
      <Stack spacing={0.25} sx={{ px: 0.5 }}>
        {rows.map((a) => (
          <QuickdrawItem
            key={a.id}
            glyph={a.status === 'ok' ? <CheckCircle2 size={14} color="var(--mui-palette-success-main)" /> : <AlertCircle size={14} color="var(--mui-palette-error-main)" />}
            title={a.skill} meta={friendly(a.ran_at)} expanded={false} actions={[]}
          />
        ))}
      </Stack>
    </QuickdrawSection>
  )
}
