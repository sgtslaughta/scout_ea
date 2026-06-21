import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getTopics, addTopic, updateTopic, deleteTopic, type Topic } from '@/api'
import { toast } from 'sonner'
import { SkeletonRow } from '@/components/SkeletonRow'

const PRIORITY_LEVELS = [
  { value: 1, label: 'Critical' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
  { value: 5, label: 'Very Low' },
]

const getPriorityColor = (priority: number): string => {
  if (priority === 1) return 'var(--color-crit)'
  if (priority <= 3) return 'var(--color-warn)'
  return 'var(--color-info)'
}

export function TopicsView() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 3,
    max_suggest: 5,
  })

  const { data: topics = [], isLoading, error, refetch } = useQuery({
    queryKey: ['topics'],
    queryFn: () => getTopics(),
  })

  const addMutation = useMutation({
    mutationFn: () => addTopic(formData),
    onSuccess: () => {
      toast.success(`Added topic "${formData.name}"`)
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      resetForm()
    },
    onError: (err: any) => {
      if (err.message.includes('409')) {
        toast.error('A topic with that name already exists.')
      } else {
        toast.error('Failed to add topic')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateTopic(editingId!, formData),
    onSuccess: () => {
      toast.success(`Updated topic "${formData.name}"`)
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      resetForm()
    },
    onError: (err: any) => {
      if (err.message.includes('409')) {
        toast.error('A topic with that name already exists.')
      } else {
        toast.error('Failed to update topic')
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTopic(id),
    onSuccess: (_, id) => {
      const topic = topics.find(t => t.id === id)
      toast.success(`Removed topic "${topic?.name}"`)
      queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
    onError: () => toast.error('Failed to remove topic'),
  })

  const resetForm = () => {
    setFormData({ name: '', description: '', priority: 3, max_suggest: 5 })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (topic: Topic) => {
    setFormData({
      name: topic.name,
      description: topic.description || '',
      priority: topic.priority,
      max_suggest: topic.max_suggest,
    })
    setEditingId(topic.id)
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
        <h2 className="text-3xl font-display font-semibold text-text mb-6">Topics</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2 justify-between">
            <span>Error loading topics</span>
            <button onClick={() => refetch()} className="underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Add/Edit form */}
        {showForm ? (
          <div className="bg-surface border border-border rounded-lg p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="topics-name" className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Name *
                </label>
                <input
                  id="topics-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Topic name"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="topics-description" className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Description (optional)
                </label>
                <textarea
                  id="topics-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Topic description"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label htmlFor="topics-priority" className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Priority
                </label>
                <select
                  id="topics-priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                >
                  {PRIORITY_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.value} - {level.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="topics-maxSuggest" className="block text-xs uppercase tracking-wider text-muted mb-2">
                  Max Suggestions
                </label>
                <input
                  id="topics-maxSuggest"
                  type="number"
                  value={formData.max_suggest}
                  onChange={(e) => setFormData({ ...formData, max_suggest: Number(e.target.value) })}
                  min="1"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
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
                    : editingId ? 'Save Changes' : 'Add Topic'}
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
            + Add Topic
          </button>
        )}

        {/* Topics list */}
        {isLoading ? (
          <div className="space-y-0">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : topics.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-sm">
            No topics yet. Add one above to get started.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {topics.map((topic, idx) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getPriorityColor(topic.priority) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{topic.name}</div>
                    {topic.description && (
                      <div className="text-xs text-muted truncate">{topic.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="px-2 py-1 text-xs bg-surface-2 border border-border/50 text-muted rounded font-mono">
                    max {topic.max_suggest}
                  </div>
                  <button
                    onClick={() => handleEdit(topic)}
                    className="px-3 py-1 text-xs bg-surface-2 border border-border text-text rounded hover:border-accent transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(topic.id)}
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
