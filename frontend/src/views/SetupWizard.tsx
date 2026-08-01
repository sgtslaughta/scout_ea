import { useEffect, useState } from 'react'
import {
  Box, Stepper, Step, StepLabel, Button, Stack, TextField, Typography,
  Paper, IconButton, Alert, CircularProgress, Card, CardContent, Collapse,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import {
  getMcpConfig, getConfig, setConfig, getMcpStatus, getSkills, type McpConfig, type Skill,
} from '../api'
import { buildBootstrapPrompt } from './setup/bootstrapPrompt'

const STEPS = ['Connect Scout', 'Set it up']

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
      <Typography variant="body1">
        First, introduce Scout to this dashboard. You'll do this once.
      </Typography>
      <Typography variant="body1">
        In Scout, open <b>Settings</b> → <b>MCP servers</b> and choose <b>Add server</b>.
        Fill in the three boxes below — click the copy button on each one and paste it across.
      </Typography>
      <TextField label="1. Name — call it this" size="small" value={name}
        onChange={(e) => onName(e.target.value)}
        onBlur={() => setConfig('mcp_name', name)} sx={{ maxWidth: 320 }} />
      <CopyRow label="2. Address" value={cfg?.url ?? ''} />
      {cfg?.configured
        ? <CopyRow label="3. Token" value={cfg.token} />
        : <Alert severity="warning">
            This dashboard has no token set yet, so Scout can't connect. Ask whoever set it up to
            set EA_MCP_TOKEN, then reload this page.
          </Alert>}
      <Box>
        <Typography variant="body1" sx={{ mb: 1 }}>
          Then send Scout this message. When the tick turns green, it worked.
        </Typography>
        <CopyRow label="Send to Scout" value="List your available tools" />
        {connected
          ? <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success">
              Scout is connected. Click Next.
            </Alert>
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
      </Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={active === 0} onClick={() => setActive((s) => s - 1)}>Back</Button>
        {active === STEPS.length - 1
          ? <Button variant="contained" onClick={() => setConfig('wizard_done', '1')}>Finish</Button>
          : <Button variant="contained" onClick={() => setActive((s) => s + 1)}>Next</Button>}
      </Stack>
    </Box>
  )
}

/** "chat_preferred" -> "Chat preferred", so the list reads like English. */
function titleCase(name: string): string {
  const words = name.split('_').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Polls for the moment Scout fetches the install bundle. That request is the
 * only thing that reaches us when the pasted message runs -- everything else it
 * does happens in files on the user's own machine.
 */
function useInstallLanded(): boolean {
  const [openedAt] = useState(() => new Date().toISOString())
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    if (landed) return
    const t = setInterval(async () => {
      const cfg = await getConfig()
      if (cfg.install_fetched_at && cfg.install_fetched_at > openedAt) setLanded(true)
    }, 3000)
    return () => clearInterval(t)
  }, [landed, openedAt])
  return landed
}

function Step2Skills({ mcpName }: { mcpName: string }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [copied, setCopied] = useState(false)
  const [showList, setShowList] = useState(false)
  const landed = useInstallLanded()
  useEffect(() => { getSkills().then(setSkills) }, [])
  return (
    <Stack spacing={2}>
      <Typography variant="body1">
        Copy the message below, paste it into Scout, and send it. Scout does the rest —
        it sets up all {skills.length} of its jobs for you.
      </Typography>
      <Button variant="contained" size="large" startIcon={<ContentCopyIcon />}
        onClick={() => {
          navigator.clipboard.writeText(
            buildBootstrapPrompt({ baseUrl: window.location.origin, mcpName }))
          setCopied(true)
        }}
        sx={{ alignSelf: 'flex-start' }}>
        {copied ? 'Copied — now paste it into Scout' : 'Copy the setup message'}
      </Button>
      {landed
        ? <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success">
            Scout picked it up. You're all set.
          </Alert>
        : copied
          ? <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
              <CircularProgress size={16} />
              <Typography variant="body2">Waiting for Scout to run it…</Typography>
            </Stack>
          : null}

      <Box>
        <Button size="small" onClick={() => setShowList((v) => !v)}>
          {showList ? 'Hide the details' : 'What will it set up?'}
        </Button>
      </Box>
      <Collapse in={showList} unmountOnExit><Stack spacing={2}>
      {/* Read-only: the point of this step is that nothing here needs doing
          by hand. It answers "what am I agreeing to?", nothing more. */}
      {skills.map((s) => (
        <Card key={s.name} variant="outlined">
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2">{titleCase(s.name)}</Typography>
            <Typography variant="body2" color="text.secondary">{s.description}</Typography>
            <Typography variant="caption" color="text.disabled">Runs {s.schedule}</Typography>
          </CardContent>
        </Card>
      ))}
      </Stack></Collapse>
    </Stack>
  )
}

