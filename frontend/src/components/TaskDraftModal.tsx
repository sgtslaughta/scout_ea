import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import type { SelectChangeEvent } from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { toast } from 'sonner'
import { createTask } from '@/api'

/** A pre-filled task, built by a tile from one of its own rows. */
export interface TaskDraft {
  title: string
  detail?: string
  dueAt?: string        // ISO date or datetime; may be absent
  personName?: string   // shown as a read-only hint, not written to the task
  source?: string        // e.g. "OU Feedback — Dana R., Jul 30"
}

const PRIORITY_OPTIONS = [
  { value: 2, label: 'High' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Low' },
] as const

const DEFAULT_PRIORITY = 3

/** `From: ${source}`, a blank line, then any existing detail — all still editable text. */
function buildInitialDetail(draft: TaskDraft): string {
  const lines: string[] = []
  if (draft.source) lines.push(`From: ${draft.source}`, '')
  if (draft.detail) lines.push(draft.detail)
  return lines.join('\n')
}

export interface TaskDraftModalProps {
  open: boolean
  draft: TaskDraft | null
  onClose: () => void
}

/**
 * Editable confirmation dialog for a task drafted from a dashboard row.
 * Nothing is written until the user hits Save — every field can be changed
 * or cleared first.
 */
export function TaskDraftModal({ open, draft, onClose }: TaskDraftModalProps) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState<number>(DEFAULT_PRIORITY)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !draft) return
    setTitle(draft.title)
    setDetail(buildInitialDetail(draft))
    setDueAt(draft.dueAt ?? '')
    setPriority(DEFAULT_PRIORITY)
    // Autofocus and select so typing over the drafted title is a single action.
    const id = requestAnimationFrame(() => titleRef.current?.select())
    return () => cancelAnimationFrame(id)
  }, [open, draft])

  const saveMutation = useMutation({
    mutationFn: () => createTask({
      title: title.trim(),
      detail: detail.trim() || undefined,
      due_at: dueAt || undefined,
      priority,
    }),
    onSuccess: () => {
      toast.success('Task created')
      qc.invalidateQueries({ queryKey: ['tasks'] })
      onClose()
    },
    onError: () => toast.error("Couldn't create the task"),
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create a task from this</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {draft?.personName && (
          <Typography variant="body2" color="text.secondary">About: {draft.personName}</Typography>
        )}
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          fullWidth
          inputRef={titleRef}
        />
        <TextField
          label="Detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          multiline
          rows={3}
          fullWidth
        />
        <Stack direction="row" spacing={2}>
          <TextField
            label="Due date"
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1 }}
          />
          <FormControl sx={{ flex: 1 }}>
            <InputLabel id="task-draft-priority-label">Priority</InputLabel>
            <Select
              labelId="task-draft-priority-label"
              label="Priority"
              value={priority}
              onChange={(e: SelectChangeEvent<number>) => setPriority(Number(e.target.value))}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!title.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TaskDraftModal
