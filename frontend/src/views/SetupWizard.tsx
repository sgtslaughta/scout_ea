import { useState } from 'react'
import { Box, Stepper, Step, StepLabel, Button, Stack } from '@mui/material'

const STEPS = ['Connect', 'Skills', 'Automations']

export function SetupWizard() {
  const [active, setActive] = useState(0)
  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', p: 2 }}>
      <Stepper activeStep={active} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>
      <Box sx={{ minHeight: 200 }}>
        {active === 0 && <Step1Connect />}
        {active === 1 && <Step2Skills />}
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

// Placeholder step bodies — filled by Tasks 7–9.
function Step1Connect() { return <div>Connect step</div> }
function Step2Skills() { return <div>Skills step</div> }
function Step3Automations() { return <div>Automations step</div> }
