import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';

interface Props {
  children: ReactNode;
  /** Short name of the area, shown in the error message. */
  area?: string;
  /** Changing this value resets the boundary (e.g. the active document id). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/** Catches render errors in a region so the rest of the app keeps working. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Inkwell] ${this.props.area ?? 'App'} crashed`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box sx={{ p: 3 }} role="alert">
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          }
        >
          <AlertTitle>{this.props.area ?? 'This area'} hit a problem</AlertTitle>
          Your writing is saved. {this.state.error.message}
        </Alert>
      </Box>
    );
  }
}
