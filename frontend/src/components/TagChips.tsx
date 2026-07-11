import { Box, Chip } from '@mui/material'
import { User, Hash } from 'lucide-react'
import { colorOf } from '@/lib/tagColors'
import type { ContentTag, ContentLink } from '@/api'

const LINK_ICON: Record<string, React.ReactElement | null> = {
  person: <User size={11} />,
  topic: <Hash size={11} />
}

interface Props {
  tags?: ContentTag[]
  links?: ContentLink[]
  onTagClick?: (t: ContentTag) => void
  onLinkClick?: (l: ContentLink) => void
}

/** Display-only tag + link chips (colors from palette keys). Pass onClick handlers
 *  to make chips actionable (filter / navigate). */
export function TagChips({ tags = [], links = [], onTagClick, onLinkClick }: Props) {
  if (!tags.length && !links.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
      {links.map((l) => {
        const icon = LINK_ICON[l.target_type]
        return (
          <Chip
            key={`k${l.id}`} size="small" {...(icon ? { icon } : {})} label={l.label}
            onClick={onLinkClick ? () => onLinkClick(l) : undefined}
            sx={{ height: 20, fontSize: 10, cursor: onLinkClick ? 'pointer' : 'default' }}
          />
        )
      })}
      {tags.map((t) => {
        const c = colorOf(t.color)
        return (
          <Chip
            key={`t${t.tag_id}`} size="small" label={t.name}
            onClick={onTagClick ? () => onTagClick(t) : undefined}
            sx={{ height: 20, fontSize: 10, bgcolor: c.bg, color: c.fg, cursor: onTagClick ? 'pointer' : 'default' }}
          />
        )
      })}
    </Box>
  )
}
