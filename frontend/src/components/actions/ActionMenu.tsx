import { useState } from 'react'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import { Zap } from 'lucide-react'
import { actionsForEntity, type ActionSpec, type EntityType } from '../../lib/actions'
import { ActionComposeModal } from './ActionComposeModal'

export function ActionMenu({ entity, onDone }: {
  entity: { type: EntityType; id: number }
  onDone?: () => void
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [spec, setSpec] = useState<ActionSpec | null>(null)
  const specs = actionsForEntity(entity.type)
  if (specs.length === 0) return null

  return (
    <>
      <Tooltip title="Actions">
        <IconButton size="small" aria-label="Actions" onClick={(e) => setAnchor(e.currentTarget)}>
          <Zap size={16} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {specs.map((s) => (
          <MenuItem key={s.type} onClick={() => { setSpec(s); setAnchor(null) }}>{s.label}</MenuItem>
        ))}
      </Menu>
      {spec && (
        <ActionComposeModal open spec={spec} entity={entity}
          onClose={() => setSpec(null)} onDone={onDone} />
      )}
    </>
  )
}
