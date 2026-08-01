import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQuickLinks, saveQuickLinks, type QuickLink } from '@/api'

// Quick links live in the config table, which is not hot data — no
// refetchInterval; mutations invalidate the query to pick up changes.
export function useQuickLinks() {
  const qc = useQueryClient()
  const { data: raw = [] } = useQuery({ queryKey: ['quick-links'], queryFn: getQuickLinks })

  const links = [...raw].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const save = useMutation({
    mutationFn: (next: QuickLink[]) => saveQuickLinks(next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-links'] }),
  })

  const addLink = (link: QuickLink) => save.mutateAsync([...raw, link])

  const editLink = (originalName: string, link: QuickLink) =>
    save.mutateAsync(raw.map((l) => (l.name === originalName ? link : l)))

  const removeLink = (name: string) =>
    save.mutateAsync(raw.filter((l) => l.name !== name))

  return { links, addLink, editLink, removeLink }
}
