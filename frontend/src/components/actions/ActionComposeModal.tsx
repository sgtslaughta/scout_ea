import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material'
import { toast } from 'sonner'
import { createAction } from '../../api'
import type { ActionSpec, EntityType } from '../../lib/actions'

export function ActionComposeModal({ open, spec, entity, extraPayload, onClose, onDone }: {
  open: boolean
  spec: ActionSpec
  entity?: { type: EntityType; id: number }
  /**
   * Payload keys the executing skill needs but the user shouldn't type or see —
   * e.g. `external_ref`, the provider message id that lets run_comms find the
   * actual mail. Merged over the typed values, so a same-named form field can't
   * clobber the real identifier.
   */
  extraPayload?: Record<string, unknown>
  onClose: () => void
  onDone?: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const missing = spec.fields.some((f) => f.required && !values[f.key]?.trim())

  const submit = async (approve: boolean) => {
    await createAction({
      action_type: spec.type,
      entity_type: entity?.type,
      entity_id: entity?.id,
      mode: spec.mode,
      payload: { ...values, ...extraPayload },
      approve,
    })
    toast.success(approve ? 'Approved — Scout will send it' : 'Saved to your Actions queue')
    setValues({})
    onDone?.()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{spec.label}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        {spec.fields.map((f) => (
          <TextField key={f.key} label={f.label} value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            multiline={f.type === 'textarea'} rows={f.type === 'textarea' ? 4 : undefined}
            fullWidth required={f.required} />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => submit(false)} disabled={missing}>Save draft</Button>
        {spec.mode === 'review' && (
          <Button variant="contained" onClick={() => submit(true)} disabled={missing}>Approve &amp; send</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
