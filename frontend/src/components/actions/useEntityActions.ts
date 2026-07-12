import { useQuery } from '@tanstack/react-query'
import { listActions, type Action } from '../../api'

const OPEN = new Set(['drafted', 'approved', 'executing'])

export function useEntityActions() {
  const { data: actions = [] } = useQuery({
    queryKey: ['actions'], queryFn: () => listActions(), refetchInterval: 10000,
  })
  return (type: string, id: number): Action | undefined =>
    actions.find((a) => a.entity_type === type && a.entity_id === id && OPEN.has(a.status))
}
