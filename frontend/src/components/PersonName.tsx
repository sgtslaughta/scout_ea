import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { addPerson, getPeople, type Person } from '@/api'

export interface PersonNameProps {
  name: string
  email?: string
}

const DEFAULT_IMPORTANCE = 3

const IMPORTANCE_LABEL: Record<number, string> = {
  1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Very low',
}

// Matching by address (via person_handles, channel "email") is what lets
// this survive a display-name rename; name match is only the fallback for
// when there's no address to go on.
function findTracked(people: Person[], name: string, email?: string): Person | undefined {
  const lowerName = name.trim().toLowerCase()
  const lowerEmail = email?.trim().toLowerCase()
  return people.find((p) => {
    if (lowerEmail && p.handles?.some((h) => h.channel === 'email' && h.handle.toLowerCase() === lowerEmail)) {
      return true
    }
    return p.name.trim().toLowerCase() === lowerName
  })
}

/**
 * Renders a person's name with a quiet, hover/focus-revealed "track this
 * person" action. If the name (or email) already matches someone in the
 * key-people list, shows their importance instead of a duplicate action.
 */
export function PersonName({ name, email }: PersonNameProps) {
  const qc = useQueryClient()
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople() })
  const tracked = useMemo(() => findTracked(people, name, email), [people, name, email])

  const addMutation = useMutation({
    mutationFn: () => addPerson({
      name,
      importance: DEFAULT_IMPORTANCE,
      email,
    }),
    onSuccess: (result) => {
      toast.success(result.existing ? `${name} is already tracked` : `Now tracking ${name}`)
      qc.invalidateQueries({ queryKey: ['people'] })
    },
    onError: () => toast.error(`Couldn't track ${name}`),
  })

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5,
        '&:hover .person-track-action, &:focus-within .person-track-action': { opacity: 1 },
      }}
    >
      <Box component="span">{name}</Box>
      {tracked ? (
        <Tooltip title={`Already tracked — importance ${tracked.importance} (${IMPORTANCE_LABEL[tracked.importance] ?? tracked.importance})`}>
          <Chip
            size="small"
            variant="outlined"
            label={tracked.importance}
            sx={{ height: 18, fontSize: 11, opacity: 0.7 }}
          />
        </Tooltip>
      ) : (
        <Tooltip title="Track this person">
          <IconButton
            className="person-track-action"
            size="small"
            aria-label={`Track ${name}`}
            disabled={addMutation.isPending}
            onClick={() => addMutation.mutate()}
            sx={{ p: 0.25, opacity: 0, transition: 'opacity 0.15s', '@media (hover: none)': { opacity: 1 } }}
          >
            <UserPlus size={14} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}

export default PersonName
