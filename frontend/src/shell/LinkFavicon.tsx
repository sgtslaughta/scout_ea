import { useState } from 'react'
import { Box } from '@mui/material'
import { Globe } from 'lucide-react'
import { safeHttpUrl } from '@/lib/url'

/**
 * The site's own /favicon.ico, with a neutral globe as the fallback.
 *
 * Deliberately not a third-party favicon service: most of these links point at
 * internal tools (MSX, GRACE, SharePoint) that a public service can't reach,
 * and routing the user's link list through someone else's server to render an
 * icon isn't a trade worth making.
 */
export function faviconUrl(rawUrl: string): string | null {
  const safe = safeHttpUrl(rawUrl)
  if (!safe) return null
  try {
    return `${new URL(safe).origin}/favicon.ico`
  } catch {
    return null
  }
}

export function LinkFavicon({ url, size = 16 }: { url: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const src = faviconUrl(url)

  if (!src || failed) {
    return <Globe size={size} aria-hidden style={{ flexShrink: 0, opacity: 0.55 }} />
  }

  return (
    <Box
      component="img"
      src={src}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      sx={{ width: size, height: size, flexShrink: 0, objectFit: 'contain' }}
    />
  )
}
