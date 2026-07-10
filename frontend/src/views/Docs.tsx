import { useQuery } from '@tanstack/react-query'
import { getSkills } from '@/api'
import { Copy, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Box, Typography, Paper, CircularProgress, useTheme } from '@mui/material'

export function DocsView() {
  const theme = useTheme()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['skills'],
    queryFn: getSkills,
  })

  const copySkill = (name: string, body: string) => {
    navigator.clipboard.writeText(body)
    toast.success(`Copied ${name}`)
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          height: 64,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          px: 6,
        }}
      >
        <Typography variant="h6" sx={{ fontFamily: 'display', fontWeight: 500 }}>
          Skills Library
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 6, py: 6 }}>
        {/* Quickstart blurb */}
        <Box sx={{ mb: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Paste these automations into Microsoft Scout to install them.
            </Typography>
          </Paper>
        </Box>

        {/* Loading */}
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 12 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Error */}
        {error && !isLoading && (
          <Box sx={{ display: 'flex', gap: 1.5, p: 2, alignItems: 'flex-start' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Failed to load skills
              </Typography>
              <button
                onClick={() => refetch()}
                style={{
                  fontSize: '0.75rem',
                  marginTop: '0.5rem',
                  color: theme.palette.primary.main,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Try again
              </button>
            </Box>
          </Box>
        )}

        {/* Empty state */}
        {!isLoading && !error && (!data || data.length === 0) && (
          <Typography
            variant="body2"
            sx={{ textAlign: 'center', color: 'text.secondary', py: 12 }}
          >
            No skills yet. Create one to get started.
          </Typography>
        )}

        {/* Skills grid */}
        {data && data.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
            {data.map((skill) => (
              <Paper
                key={skill.name}
                variant="outlined"
                sx={{
                  p: 2,
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    opacity: 0.8,
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontFamily: 'display', fontWeight: 500, overflow: 'hidden' }}
                    >
                      {skill.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      {skill.description}
                    </Typography>
                    {skill.schedule && (
                      <Box
                        sx={{
                          mt: 1,
                          display: 'inline-block',
                          px: 1,
                          py: 0.5,
                          bgcolor: theme.palette.action.hover,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 0.5,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                        }}
                      >
                        {skill.schedule}
                      </Box>
                    )}
                  </Box>
                  <button
                    onClick={() => copySkill(skill.name, skill.body)}
                    style={{
                      flexShrink: 0,
                      padding: '0.5rem',
                      borderRadius: '0.25rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: theme.palette.primary.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label={`Copy ${skill.name} to clipboard`}
                  >
                    <Copy size={18} />
                  </button>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
