import { useQuery } from '@tanstack/react-query'
import { getSkills } from '@/api'
import { Copy, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function DocsView() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['skills'],
    queryFn: getSkills,
  })

  const copySkill = (name: string, body: string) => {
    navigator.clipboard.writeText(body)
    toast.success(`Copied ${name}`)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-6">
        <h1 className="text-display text-lg text-text">Skills Library</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Quickstart blurb */}
        <div className="mb-6 p-4 bg-surface-2 border border-border rounded-lg">
          <p className="text-sm text-muted">
            Paste these automations into Microsoft Scout to install them.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-accent" size={24} />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="flex items-start gap-3 p-4 bg-surface-2 border border-crit rounded-lg">
            <AlertCircle size={20} className="text-crit flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-text font-medium">Failed to load skills</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-accent mt-2 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && (!data || data.length === 0) && (
          <p className="text-center text-muted py-12">No skills yet. Create one to get started.</p>
        )}

        {/* Skills grid */}
        {data && data.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {data.map((skill) => (
              <div
                key={skill.name}
                className="p-4 bg-surface border border-border rounded-lg hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-display text-base text-text font-medium">
                      {skill.name}
                    </h3>
                    <p className="text-sm text-muted mt-1">{skill.description}</p>
                    {skill.schedule && (
                      <div className="mt-2 inline-block px-2 py-1 bg-surface-2 border border-border rounded font-mono text-xs text-muted">
                        {skill.schedule}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => copySkill(skill.name, skill.body)}
                    className="flex-shrink-0 p-2 rounded hover:bg-surface-2 transition-colors text-accent"
                    aria-label={`Copy ${skill.name} to clipboard`}
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
