import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Box } from '@mui/material'

/**
 * Render user text as GitHub-flavored Markdown. react-markdown is XSS-safe by
 * default (no raw HTML), so user detail can't inject markup. Styling is tuned
 * for compact surfaces (cards, tooltips).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <Box
      sx={{
        fontSize: 13, lineHeight: 1.4,
        '& p': { m: 0, mb: 0.5 },
        '& p:last-child': { mb: 0 },
        '& ul, & ol': { m: 0, mb: 0.5, pl: 2.5 },
        '& h1, & h2, & h3, & h4': { fontSize: '1em', fontWeight: 700, m: 0, mt: 0.5 },
        '& a': { color: 'primary.main' },
        '& code': { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85em', bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5 },
        '& pre': { m: 0, mb: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1, overflowX: 'auto' },
        '& pre code': { bgcolor: 'transparent', px: 0 },
        '& blockquote': { m: 0, mb: 0.5, pl: 1, borderLeft: '3px solid', borderColor: 'divider', color: 'text.secondary' },
        '& table': { borderCollapse: 'collapse' },
        '& th, & td': { border: '1px solid', borderColor: 'divider', px: 0.5, py: 0.25 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </Box>
  )
}
