import { Box } from '@mui/material'

export interface CloudFieldProps {
  /** Number of cloud clusters to render. */
  count: number
  /** Offsets the deterministic seed so adjacent fields (e.g. rain's clouds) don't repeat geometry. */
  seedOffset?: number
  /** Darker, denser puffs (rain/storm). */
  dark?: boolean
  /** Thin, sparse wisps (clear-sky accents). */
  thin?: boolean
}

/**
 * Deterministic pseudo-random value in [0, 1) derived purely from an integer
 * seed. Intentionally NOT Math.random(): cloud geometry must be identical
 * across re-renders (sky-phase ticks every 60s, react-query refetches, etc.)
 * or every cloud would visibly jump each time the component re-renders.
 */
function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

interface Puff {
  left: number
  top: number
  width: number
  height: number
  opacity: number
}

function buildPuffs(clusterSeed: number, dark: boolean, thin: boolean): Puff[] {
  const puffCount = 3 + Math.floor(seeded(clusterSeed * 5 + 2) * 3) // 3-5
  const baseOpacity = thin ? 0.18 : dark ? 0.55 : 0.4
  return Array.from({ length: puffCount }, (_, i) => {
    const s = clusterSeed * 11 + i * 13
    const width = (thin ? 30 : 45) + seeded(s + 3) * 40
    return {
      left: seeded(s + 1) * 70,
      top: seeded(s + 2) * 20,
      width,
      height: width * (0.5 + seeded(s + 4) * 0.2),
      opacity: Number((baseOpacity * (0.7 + seeded(s + 5) * 0.5)).toFixed(2)),
    }
  })
}

function CloudCluster({ index, dark, thin }: { index: number; dark: boolean; thin: boolean }) {
  const top = 5 + seeded(index * 3 + 1) * 70 // 5%-75% vertical spread
  const scale = thin ? 0.5 + seeded(index * 3 + 2) * 0.3 : 0.7 + seeded(index * 3 + 2) * 0.7 // varied "distance"
  const duration = 120 + seeded(index * 3 + 3) * 180 // 120s-300s, no racing
  const delay = -(seeded(index * 7 + 5) * duration)
  const puffs = buildPuffs(index, dark, thin)
  const color = dark ? '90, 90, 105' : '255, 255, 255'

  return (
    <Box
      data-testid="cloud"
      sx={{
        position: 'absolute',
        top: `${top.toFixed(1)}%`,
        left: '-15%',
        width: '140px',
        height: '60px',
        transform: `scale(${scale.toFixed(2)})`,
        animation: `driftClouds ${duration.toFixed(0)}s linear infinite`,
        animationDelay: `${delay.toFixed(1)}s`,
      }}
    >
      {puffs.map((p, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: `${p.left.toFixed(1)}%`,
            top: `${p.top.toFixed(1)}%`,
            width: `${p.width.toFixed(0)}px`,
            height: `${p.height.toFixed(0)}px`,
            borderRadius: '50%',
            background: `rgba(${color}, ${p.opacity})`,
          }}
        />
      ))}
    </Box>
  )
}

/** A field of cloud clusters — each cluster is 3-5 overlapping soft ellipses
 * that travel together as one body, sized/positioned/timed deterministically
 * from their index so re-renders never reshuffle geometry. */
export function CloudField({ count, seedOffset = 0, dark = false, thin = false }: CloudFieldProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <CloudCluster key={i} index={i + seedOffset} dark={dark} thin={thin} />
      ))}
    </>
  )
}
