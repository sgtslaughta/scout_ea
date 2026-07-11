import { Component } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'

interface Props {
  children: ReactNode
}

interface State {
  error?: Error
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch() {
    // Log error or perform other side effects
  }

  handleReload = () => {
    this.setState({ error: undefined })
  }

  render() {
    if (this.state.error) {
      return (
        <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={this.handleReload}>
                Reload view
              </Button>
            }
          >
            <AlertTitle>This view hit an error</AlertTitle>
            {this.state.error.message}
          </Alert>
        </Box>
      )
    }
    return this.props.children
  }
}
