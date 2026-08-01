import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { CircleCheck, CirclePlus } from 'lucide-react'
import { TaskDraftModal } from './TaskDraftModal'
import type { TaskDraft } from './TaskDraftModal'

export interface RowTaskButtonProps {
  draft: TaskDraft
  /** True when this row already produced a task — the action stays enabled, since one row can legitimately need two follow-ups. */
  alreadyAdded?: boolean
}

/**
 * Quiet, hover/focus-revealed "create a task from this row" action — a
 * sibling of PersonName's track action, opening TaskDraftModal on click.
 */
export function RowTaskButton({ draft, alreadyAdded }: RowTaskButtonProps) {
  const [open, setOpen] = useState(false)
  const label = alreadyAdded ? 'Task already created — add another?' : 'Create a task from this'
  const Icon = alreadyAdded ? CircleCheck : CirclePlus

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          className="row-task-action"
          size="small"
          aria-label={label}
          onClick={() => setOpen(true)}
          sx={{ p: 0.25, opacity: 0, transition: 'opacity 0.15s', '@media (hover: none)': { opacity: 1 } }}
        >
          <Icon size={14} />
        </IconButton>
      </Tooltip>
      <TaskDraftModal open={open} draft={draft} onClose={() => setOpen(false)} />
    </>
  )
}

export default RowTaskButton
