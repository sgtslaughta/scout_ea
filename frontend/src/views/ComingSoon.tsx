import { Box, Typography } from '@mui/material'

interface ComingSoonProps {
  title: string
}

export function ComingSoonView({ title }: ComingSoonProps) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography color="text.secondary">Coming soon</Typography>
      </Box>
    </Box>
  )
}
