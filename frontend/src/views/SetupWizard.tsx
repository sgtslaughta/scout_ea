import { useEffect, useState } from 'react'
import {
  Box, Stepper, Step, StepLabel, Button, Stack, TextField, Typography,
  Paper, IconButton, Alert, CircularProgress,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import {
  getMcpConfig, getConfig, setConfig, getMcpStatus, type McpConfig,
} from '../api'

const STEPS = ['Connect', 'Skills', 'Automations']

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 1 }}>
      <Typography variant="caption" sx={{ minWidth: 96, color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>{value}</Typography>
      <IconButton size="small" aria-label={`copy ${label}`}
        onClick={() => navigator.clipboard.writeText(value)}>
        <ContentCopyIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
}

function Step1Connect({ name, onName }: { name: string; onName: (n: string) => void }) {
  const [cfg, setCfg] = useState<McpConfig | null>(null)
  const [openedAt, setOpenedAt] = useState<string>('')
  const [connected, setConnected] = useState(false)

  useEffect(() => { getMcpConfig().then(setCfg) }, [])
  useEffect(() => { setOpenedAt(new Date().toISOString()) }, [])
  useEffect(() => {
    if (connected) return
    const t = setInterval(async () => {
      const { last_seen } = await getMcpStatus()
      if (last_seen && openedAt && last_seen > openedAt) setConnected(true)
    }, 3000)
    return () => clearInterval(t)
  }, [connected, openedAt])

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        An MCP connection lets Scout use this assistant's tools. Name it, then paste the address
        and token into Scout's <b>Add MCP server</b> dialog.
      </Typography>
      <TextField label="Connection name" size="small" value={name}
        onChange={(e) => onName(e.target.value)}
        onBlur={() => setConfig('mcp_name', name)} sx={{ maxWidth: 320 }} />
      <CopyRow label="Address" value={cfg?.url ?? ''} />
      {cfg?.configured
        ? <CopyRow label="Token" value={cfg.token} />
        : <Alert severity="warning">Server token not set (EA_MCP_TOKEN). Set it, then reload.</Alert>}
      <Box>
        <Typography variant="subtitle2">Check the connection</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          In Scout, send this message, then wait for the check to turn green:
        </Typography>
        <CopyRow label="Ask Scout" value="List your available tools" />
        {connected
          ? <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success">Scout reached your MCP.</Alert>
          : <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
              <CircularProgress size={16} /><Typography variant="body2">Waiting for Scout…</Typography>
            </Stack>}
      </Box>
    </Stack>
  )
}

export function SetupWizard() {
  const [active, setActive] = useState(0)
  const [name, setName] = useState('scout-ea')
  useEffect(() => { getConfig().then((c) => { if (c.mcp_name) setName(c.mcp_name) }) }, [])
  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', p: 2 }}>
      <Stepper activeStep={active} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>
      <Box sx={{ minHeight: 200 }}>
        {active === 0 && <Step1Connect name={name} onName={setName} />}
        {active === 1 && <Step2Skills mcpName={name} />}
        {active === 2 && <Step3Automations />}
      </Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={active === 0} onClick={() => setActive((s) => s - 1)}>Back</Button>
        <Button variant="contained" disabled={active === STEPS.length - 1}
                onClick={() => setActive((s) => s + 1)}>Next</Button>
      </Stack>
    </Box>
  )
}

// Placeholder step bodies — filled by Tasks 8–9.
function Step2Skills({ mcpName }: { mcpName: string }) { return <div>Skills step ({mcpName})</div> }
function Step3Automations() { return <div>Automations step</div> }
