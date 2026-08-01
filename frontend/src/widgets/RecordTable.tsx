import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { RowTaskButton } from '@/components/RowTaskButton'
import type { TaskDraft } from '@/components/TaskDraftModal'

/**
 * One column of a RecordTable. `compact` columns show in both the narrow
 * tile view and the wide modal view; the rest only appear once the table
 * has room (e.g. the WidgetCard expand-to-modal dialog). `render` gets a
 * `dense` flag so a column (e.g. money) can format more tersely when narrow.
 */
export interface RecordColumn<T> {
  key: string
  header: string
  render: (row: T, ctx: { dense: boolean }) => ReactNode
  compact?: boolean
  align?: 'left' | 'right'
}

export interface RecordTableProps<T> {
  rows: T[]
  columns: RecordColumn<T>[]
  getRowId: (row: T) => string | number
  emptyMessage?: string
  /** container width, in px, at/above which non-compact columns also render */
  wideAt?: number
  /**
   * When supplied, every body row gets a trailing "create a task" cell.
   * Returning null means no button for that row. Shown in both the narrow
   * tile view and the wide modal view — not subject to `compact` filtering.
   */
  rowTask?: (row: T) => (TaskDraft & { alreadyAdded?: boolean }) | null
}

const DEFAULT_WIDE_AT = 520

/**
 * Generic list/table primitive for `records`-backed dashboard tiles
 * (Pipeline, OU Feedback, Territory Review, EBC, Quarterly Events, ...).
 * Carries no domain knowledge — callers supply column config and rows.
 */
export function RecordTable<T>({
  rows, columns, getRowId, emptyMessage = 'Nothing to show yet.', wideAt = DEFAULT_WIDE_AT, rowTask,
}: RecordTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setWide(el.clientWidth >= wideAt)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [wideAt])

  const visibleColumns = wide ? columns : columns.filter((c) => c.compact)

  if (rows.length === 0) {
    return (
      <Box ref={containerRef} sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
      </Box>
    )
  }

  return (
    <Box ref={containerRef} sx={{ overflow: 'auto', height: '100%' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {visibleColumns.map((c) => (
              <TableCell key={c.key} align={c.align ?? 'left'}>{c.header}</TableCell>
            ))}
            {rowTask && <TableCell padding="checkbox" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const draft = rowTask?.(row) ?? null
            return (
              <TableRow
                key={getRowId(row)}
                hover
                sx={{ '&:hover .row-task-action, &:focus-within .row-task-action': { opacity: 1 } }}
              >
                {visibleColumns.map((c) => (
                  <TableCell key={c.key} align={c.align ?? 'left'}>{c.render(row, { dense: !wide })}</TableCell>
                ))}
                {rowTask && (
                  <TableCell padding="checkbox">
                    {draft && <RowTaskButton draft={draft} alreadyAdded={draft.alreadyAdded} />}
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
  )
}
