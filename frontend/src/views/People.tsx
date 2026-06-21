import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getPeople, addPerson, updatePerson, deletePerson, type Person } from '@/api'
import { toast } from 'sonner'
import { SkeletonRow } from '@/components/SkeletonRow'

const IMPORTANCE_LEVELS = [
  { value: 1, label: 'Critical' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
  { value: 5, label: 'Very Low' },
]

const getImportanceColor = (importance: number): string => {
  if (importance === 1) return 'var(--color-crit)'
  if (importance <= 3) return 'var(--color-warn)'
  return 'var(--color-info)'
}

export function PeopleView() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    org: '',
    importance: 3,
    notes: '',
  })

  const { data: people = [], isLoading, error, refetch } = useQuery({
    queryKey: ['people'],
    queryFn: () => getPeople(),
  })

  const addMutation = useMutation({
    mutationFn: () => addPerson(formData),
    onSuccess: () => {
      toast.success(`Added ${formData.name}`)
      queryClient.invalidateQueries({ queryKey: ['people'] })
      resetForm()
    },
    onError: () => toast.error('Failed to add person'),
  })

  const updateMutation = useMutation({
    mutationFn: () => updatePerson(editingId!, formData),
    onSuccess: () => {
      toast.success(`Updated ${formData.name}`)
      queryClient.invalidateQueries({ queryKey: ['people'] })
      resetForm()
    },
    onError: () => toast.error('Failed to update person'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePerson(id),
    onSuccess: (_, id) => {
      const person = people.find(p => p.id === id)
      toast.success(`Removed ${person?.name}`)
      queryClient.invalidateQueries({ queryKey: ['people'] })
    },
    onError: () => toast.error('Failed to remove person'),
  })

  const resetForm = () => {
    setFormData({ name: '', role: '', org: '', importance: 3, notes: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (person: Person) => {
    setFormData({
      name: person.name,
      role: person.role || '',
      org: person.org || '',
      importance: person.importance,
      notes: person.notes || '',
    })
    setEditingId(person.id)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (editingId) {
      updateMutation.mutate()
    } else {
      addMutation.mutate()
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-bg">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-4">
        <h2 className="text-3xl font-display font-semibold text-text mb-6">People</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2 justify-between">
            <span>Error loading people</span>
            <button onClick={() => refetch()} className="underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Add/Edit form */}
        {showForm ? (
          <div className="bg-surface border border-border rounded-lg p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Person name"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Role (optional)
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="Job title or role"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Organization (optional)
                </label>
                <input
                  type="text"
                  value={formData.org}
                  onChange={(e) => setFormData({ ...formData, org: e.target.value })}
                  placeholder="Company or organization"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Importance
                </label>
                <select
                  value={formData.importance}
                  onChange={(e) => setFormData({ ...formData, importance: Number(e.target.value) })}
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                >
                  {IMPORTANCE_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.value} - {level.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-accent text-surface rounded-md px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {updateMutation.isPending || addMutation.isPending
                    ? editingId ? 'Updating...' : 'Adding...'
                    : editingId ? 'Save Changes' : 'Add Person'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-surface-2 border border-border text-muted rounded-md px-3 py-2 text-sm font-medium hover:border-text"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="bg-accent/10 border border-accent/30 text-accent rounded-lg px-4 py-3 text-sm font-medium hover:bg-accent/20 transition-colors"
          >
            + Add Person
          </button>
        )}

        {/* People list */}
        {isLoading ? (
          <div className="space-y-0">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : people.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-sm">
            No people yet.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {people.map((person, idx) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getImportanceColor(person.importance) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{person.name}</div>
                    {(person.role || person.org) && (
                      <div className="text-xs text-muted truncate">
                        {[person.role, person.org].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {person.notes && (
                      <div className="text-xs text-muted truncate">{person.notes}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(person)}
                    className="px-3 py-1 text-xs bg-surface-2 border border-border text-text rounded hover:border-accent transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(person.id)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
