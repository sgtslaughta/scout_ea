import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'

/**
 * Single-line text that scrolls its overflow into view on hover, and only when
 * it actually overflows (measured). Reduced-motion users get a static clip.
 */
export function MarqueeText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dist, setDist] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (el) setDist(Math.max(0, el.scrollWidth - el.clientWidth))
  }, [text])

  return (
    <Box
      ref={ref}
      title={text}
      sx={{
        flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap',
        '& > span': { display: 'inline-block' },
        '@media (prefers-reduced-motion: no-preference)': {
          '& > span': { transition: `transform ${Math.max(1.5, dist / 40)}s linear` },
          '&:hover > span': dist > 0 ? { transform: `translateX(-${dist}px)` } : {},
        },
      }}
    >
      <span>{text}</span>
    </Box>
  )
}
