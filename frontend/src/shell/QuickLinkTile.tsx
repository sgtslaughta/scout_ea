import { Box, Typography } from '@mui/material'
import type { QuickLink } from '@/api'
import { safeHttpUrl } from '@/lib/url'
import { LinkFavicon } from './LinkFavicon'

export function QuickLinkTile({ link }: { link: QuickLink }) {
  const open = () => {
    const url = safeHttpUrl(link.url)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={link.name}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open() }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        maxWidth: 190,
        px: 1.75,
        py: 1,
        borderRadius: 1,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.selected' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      <LinkFavicon url={link.url} />
      <Typography
        noWrap
        sx={{ fontSize: '1rem', color: 'text.primary' }}
      >
        {link.name}
      </Typography>
    </Box>
  )
}
