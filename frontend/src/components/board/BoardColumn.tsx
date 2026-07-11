import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Box, Typography, IconButton, TextField, Tooltip } from '@mui/material'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { BoardColumn as Column, Task } from '@/api'
import { TaskCard } from './TaskCard'

interface BoardColumnProps {
  column: Column
  tasks: Task[]
  isFirst: boolean
  isLast: boolean
  onEditTask: (t: Task) => void
  onCompleteTask: (id: number) => void
  onDismissTask: (id: number) => void
  onRename: (id: number, name: string) => void
  onDelete: (col: Column) => void
  onMove: (col: Column, dir: -1 | 1) => void
}

export function BoardColumn({
  column, tasks, isFirst, isLast,
  onEditTask, onCompleteTask, onDismissTask, onRename, onDelete, onMove,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(column.name)

  const commit = () => {
    setEditing(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== column.name) onRename(column.id, trimmed)
    else setName(column.name)
  }

  return (
    <Box sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
      {/* header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75, mb: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
        <IconButton size="small" aria-label={`Move ${column.name} left`} disabled={isFirst} onClick={() => onMove(column, -1)} sx={{ p: 0.25 }}><ChevronLeft size={14} /></IconButton>
        {editing ? (
          <TextField
            value={name} onChange={(e) => setName(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setName(column.name); setEditing(false) } }}
            size="small" autoFocus variant="standard" sx={{ flex: 1 }}
          />
        ) : (
          <Tooltip arrow title="Click to rename">
            <Typography
              variant="subtitle2" onClick={() => setEditing(true)} tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true) }}
              sx={{ flex: 1, fontWeight: 600, cursor: 'text', '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: 2 } }}
            >
              {column.name}
            </Typography>
          </Tooltip>
        )}
        <Typography variant="caption" color="text.secondary">{tasks.length}</Typography>
        <IconButton size="small" aria-label={`Move ${column.name} right`} disabled={isLast} onClick={() => onMove(column, 1)} sx={{ p: 0.25 }}><ChevronRight size={14} /></IconButton>
        <IconButton size="small" aria-label={`Delete ${column.name}`} onClick={() => onDelete(column)} sx={{ p: 0.25 }}><Trash2 size={14} /></IconButton>
      </Box>

      {/* drop zone */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1, minHeight: 120, p: 1, borderRadius: 1, overflowY: 'auto',
          bgcolor: isOver ? 'action.selected' : 'transparent',
          border: '1px dashed', borderColor: isOver ? 'primary.main' : 'transparent', transition: 'background-color 0.15s',
        }}
      >
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onEdit={onEditTask} onComplete={onCompleteTask} onDismiss={onDismissTask} />
        ))}
        {tasks.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>Drop tasks here</Typography>
        )}
      </Box>
    </Box>
  )
}
