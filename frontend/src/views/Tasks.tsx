import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Chip, Button, TextField, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Plus, ArrowUp, ArrowDown } from 'lucide-react'
import {
  getTasks, getBoardColumns, updateTask, createTask, addDeadline,
  addBoardColumn, updateBoardColumn, deleteBoardColumn,
  type Task, type BoardColumn as Column,
} from '@/api'
import { BoardColumn, STATUS_OPTIONS } from '@/components/board/BoardColumn'
import { toast } from 'sonner'

export function TasksView() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  const invalidateCols = () => queryClient.invalidateQueries({ queryKey: ['board-columns'] })

  const { data: allTasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 15000,
  })
  const { data: columns = [] } = useQuery({ queryKey: ['board-columns'], queryFn: getBoardColumns })

  const dueToday = searchParams.get('due') === 'today'
  const visibleTasks = dueToday
    ? allTasks.filter((t) => t.due_at && new Date(t.due_at).toDateString() === new Date().toDateString())
    : allTasks

  const [sortBy, setSortBy] = useState<'priority' | 'due' | 'created'>('priority')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const sortedCols = [...columns].sort((a, b) => a.position - b.position)
  const firstColId = sortedCols[0]?.id ?? null
  const doneCol = sortedCols.find((c) => c.status === 'done')
  const dismissedCol = sortedCols.find((c) => c.status === 'dismissed')

  // Dismissed tasks only appear if a dismissed column holds them; otherwise hidden.
  const boardTasks = visibleTasks.filter((t) => t.status !== 'dismissed' || t.board_column_id === dismissedCol?.id)
  const sortCards = (a: Task, b: Task) => {
    // base comparator is ascending (soonest / oldest / most-critical first); dir flips it
    const base = sortBy === 'due' ? (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')
      : sortBy === 'created' ? (a.created_at ?? '').localeCompare(b.created_at ?? '')
        : (a.priority - b.priority || (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
    return sortDir === 'asc' ? base : -base
  }
  const tasksFor = (colId: number) => boardTasks
    .filter((t) => (t.board_column_id ?? firstColId) === colId)
    .sort(sortCards)

  // --- mutations ---
  const moveMutation = useMutation({
    mutationFn: (v: { taskId: number; columnId: number; status: string }) =>
      updateTask(v.taskId, { board_column_id: v.columnId, status: v.status }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to move task'),
  })
  const setColStatusMutation = useMutation({
    mutationFn: (v: { id: number; status: string }) => updateBoardColumn(v.id, { status: v.status }),
    onSuccess: invalidateCols,
    onError: () => toast.error('Failed to set column status'),
  })
  const completeMutation = useMutation({
    mutationFn: (id: number) => updateTask(id, doneCol ? { board_column_id: doneCol.id, status: 'done' } : { status: 'done' }),
    onSuccess: () => { invalidate(); toast.success('Completed') }, onError: () => toast.error('Failed'),
  })
  const dismissMutation = useMutation({
    mutationFn: (id: number) => updateTask(id, dismissedCol ? { board_column_id: dismissedCol.id, status: 'dismissed' } : { status: 'dismissed' }),
    onSuccess: () => { invalidate(); toast.success('Dismissed') }, onError: () => toast.error('Failed'),
  })
  const addColMutation = useMutation({ mutationFn: (v: { name: string; status: string }) => addBoardColumn(v.name, v.status), onSuccess: () => { invalidateCols(); toast.success('Column added') }, onError: () => toast.error('Failed to add column') })
  const renameColMutation = useMutation({ mutationFn: (v: { id: number; name: string }) => updateBoardColumn(v.id, { name: v.name }), onSuccess: invalidateCols, onError: () => toast.error('Failed to rename') })
  const reorderMutation = useMutation({
    mutationFn: (v: { a: Column; b: Column }) => Promise.all([
      updateBoardColumn(v.a.id, { position: v.b.position }),
      updateBoardColumn(v.b.id, { position: v.a.position }),
    ]),
    onSuccess: invalidateCols,
  })
  const deleteColMutation = useMutation({ mutationFn: (id: number) => deleteBoardColumn(id), onSuccess: () => { invalidateCols(); invalidate(); toast.success('Column deleted') }, onError: () => toast.error('Failed to delete') })

  // --- edit modal (from Sub-C) ---
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [fTitle, setFTitle] = useState('')
  const [fDetail, setFDetail] = useState('')
  const [fDue, setFDue] = useState('')
  const [fPriority, setFPriority] = useState(3)
  const [fStatus, setFStatus] = useState('open')
  const updateMutation = useMutation({
    mutationFn: () => updateTask(editingId!, {
      title: fTitle.trim(), detail: fDetail.trim() || undefined,
      due_at: fDue ? new Date(fDue).toISOString() : undefined,
      priority: fPriority, status: fStatus,
    }),
    onSuccess: () => { invalidate(); toast.success('Task updated'); handleCloseEdit() },
    onError: () => toast.error('Failed to update task'),
  })
  const createMutation = useMutation({
    mutationFn: () => createTask({
      title: fTitle.trim(), detail: fDetail.trim() || undefined,
      due_at: fDue ? new Date(fDue).toISOString() : undefined,
      priority: fPriority, status: fStatus, board_column_id: firstColId ?? undefined,
    }),
    onSuccess: () => { invalidate(); toast.success('Task added'); handleCloseEdit() },
    onError: () => toast.error('Failed to add task'),
  })
  const handleEdit = (t: Task) => {
    setEditingId(t.id); setFTitle(t.title); setFDetail(t.detail ?? '')
    setFDue(t.due_at ? new Date(t.due_at).toISOString().slice(0, 10) : '')
    setFPriority(t.priority); setFStatus(t.status); setEditOpen(true)
  }
  const handleAdd = () => {
    setEditingId(null); setFTitle(''); setFDetail(''); setFDue(''); setFPriority(3); setFStatus('open'); setEditOpen(true)
  }
  const handleCloseEdit = () => { setEditOpen(false); setEditingId(null) }

  // --- convert task -> deadline (keeps the task) ---
  const [convertTask, setConvertTask] = useState<Task | null>(null)
  const [convertDue, setConvertDue] = useState('')
  const openConvert = (t: Task) => {
    setConvertTask(t)
    setConvertDue(t.due_at ? new Date(t.due_at).toISOString().slice(0, 10) : '')
  }
  const convertMutation = useMutation({
    mutationFn: (v: { title: string; due: string; detail?: string }) => addDeadline(v.title, v.due, v.detail),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deadlines'] }); toast.success('Deadline created'); setConvertTask(null) },
    onError: () => toast.error('Failed to create deadline'),
  })

  // --- column controls ---
  const [addingCol, setAddingCol] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColStatus, setNewColStatus] = useState('open')
  const [deleteTarget, setDeleteTarget] = useState<Column | null>(null)
  const submitAddCol = () => {
    const n = newColName.trim()
    if (n) addColMutation.mutate({ name: n, status: newColStatus })
    setNewColName(''); setNewColStatus('open'); setAddingCol(false)
  }
  const onMoveCol = (col: Column, dir: -1 | 1) => {
    const idx = sortedCols.findIndex((c) => c.id === col.id)
    const neighbor = sortedCols[idx + dir]
    if (neighbor) reorderMutation.mutate({ a: col, b: neighbor })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    const targetCol = Number(over.id)
    const from = (active.data.current?.columnId ?? firstColId) as number | null
    if (from === targetCol) return
    const col = sortedCols.find((c) => c.id === targetCol)
    if (!col) return
    moveMutation.mutate({ taskId: Number(active.id), columnId: targetCol, status: col.status })
  }

  return (
    <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h5">Tasks</Typography>
        {dueToday && <Chip label="Due today" size="small" onDelete={() => setSearchParams({})} />}
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small" select label="Sort" value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'priority' | 'due' | 'created')}
          slotProps={{ select: { native: true } }} sx={{ minWidth: 120 }}
        >
          <option value="priority">Priority</option>
          <option value="due">Due date</option>
          <option value="created">Created</option>
        </TextField>
        <Tooltip arrow title={sortDir === 'asc' ? 'Ascending' : 'Descending'}>
          <IconButton size="small" aria-label={`Sort ${sortDir === 'asc' ? 'ascending' : 'descending'}`} onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
            {sortDir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </IconButton>
        </Tooltip>
        {addingCol ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small" autoFocus placeholder="Column name" value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAddCol(); if (e.key === 'Escape') { setNewColName(''); setAddingCol(false) } }}
            />
            <TextField
              size="small" select label="Status" value={newColStatus}
              onChange={(e) => setNewColStatus(e.target.value)}
              slotProps={{ select: { native: true } }} sx={{ minWidth: 130 }}
            >
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </TextField>
            <Button size="small" variant="contained" onClick={submitAddCol}>Add</Button>
            <Button size="small" onClick={() => { setNewColName(''); setAddingCol(false) }}>Cancel</Button>
          </Box>
        ) : (
          <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={() => setAddingCol(true)}>Add column</Button>
        )}
        <Button size="small" variant="contained" startIcon={<Plus size={16} />} onClick={handleAdd}>Add task</Button>
      </Box>

      {error && (
        <Box sx={{ mb: 2, p: 2, borderRadius: 1, border: '1px solid', borderColor: 'error.main' }}>
          <Typography variant="body2" color="error.main">Error loading tasks. <Button size="small" onClick={() => refetch()}>Retry</Button></Typography>
        </Box>
      )}

      {!isLoading && sortedCols.length === 0 ? (
        <Typography variant="caption" color="text.secondary">No board columns.</Typography>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <Box sx={{ flex: 1, display: 'flex', gap: 2, overflowX: 'auto', overflowY: 'hidden', pb: 1 }}>
            {sortedCols.map((col, i) => (
              <BoardColumn
                key={col.id} column={col} tasks={tasksFor(col.id)}
                isFirst={i === 0} isLast={i === sortedCols.length - 1}
                onEditTask={handleEdit} onCompleteTask={completeMutation.mutate} onDismissTask={dismissMutation.mutate} onConvertTask={openConvert}
                onRename={(id, name) => renameColMutation.mutate({ id, name })}
                onSetStatus={(id, status) => setColStatusMutation.mutate({ id, status })}
                onDelete={setDeleteTarget} onMove={onMoveCol}
              />
            ))}
          </Box>
        </DndContext>
      )}

      {/* edit task modal */}
      <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit task' : 'Add task'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Title" value={fTitle} onChange={(e) => setFTitle(e.target.value)} autoFocus required fullWidth />
          <TextField label="Detail" value={fDetail} onChange={(e) => setFDetail(e.target.value)} multiline rows={2} fullWidth />
          <TextField label="Due" type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Priority" select value={fPriority} onChange={(e) => setFPriority(Number(e.target.value))} required fullWidth slotProps={{ select: { native: true } }}>
            <option value={1}>1 - Critical</option>
            <option value={2}>2 - High</option>
            <option value={3}>3 - Normal</option>
          </TextField>
          <TextField label="Status" select value={fStatus} onChange={(e) => setFStatus(e.target.value)} required fullWidth slotProps={{ select: { native: true } }}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="dismissed">Dismissed</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          {editingId && (
            <Button
              sx={{ mr: 'auto' }}
              onClick={() => {
                if (!fDue) { toast.error('Set a due date first'); return }
                convertMutation.mutate({ title: fTitle.trim(), due: new Date(fDue).toISOString(), detail: fDetail.trim() || undefined })
              }}
            >
              Convert to deadline
            </Button>
          )}
          <Button onClick={handleCloseEdit}>Cancel</Button>
          <Button variant="contained" disabled={!fTitle.trim()} onClick={() => (editingId ? updateMutation : createMutation).mutate()}>{editingId ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* convert task -> deadline */}
      <Dialog open={!!convertTask} onClose={() => setConvertTask(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Convert to deadline</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">{convertTask?.title}</Typography>
          <TextField
            label="Due" type="date" value={convertDue} onChange={(e) => setConvertDue(e.target.value)}
            required fullWidth slotProps={{ inputLabel: { shrink: true } }}
          />
          <Typography variant="caption" color="text.secondary">The task stays on the board; a deadline is created from it.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertTask(null)}>Cancel</Button>
          <Button
            variant="contained" disabled={!convertDue}
            onClick={() => convertTask && convertMutation.mutate({ title: convertTask.title, due: new Date(convertDue).toISOString(), detail: convertTask.detail || undefined })}
          >
            Create deadline
          </Button>
        </DialogActions>
      </Dialog>

      {/* delete column confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Its tasks move to the first remaining column. This doesn’t delete any tasks.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => { if (deleteTarget) deleteColMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
