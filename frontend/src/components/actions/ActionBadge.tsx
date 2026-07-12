import { Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useEntityActions } from './useEntityActions'

const LABEL: Record<string, string> = {
  drafted: 'draft ready', approved: 'queued', executing: 'running',
}

export function ActionBadge({ entityType, entityId }: { entityType: string; entityId: number }) {
  const lookup = useEntityActions()
  const navigate = useNavigate()
  const a = lookup(entityType, entityId)
  if (!a) return null
  return (
    <Chip size="small" variant="outlined" color={a.status === 'executing' ? 'warning' : 'primary'}
      label={LABEL[a.status] ?? a.status} onClick={() => navigate('/feed?view=actions')} />
  )
}
