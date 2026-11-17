import { AppThemeProvider } from '@/theme/AppThemeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Bootstrap } from '@/features/shell/Bootstrap';

/** Root: theme → error boundary → bootstrap (loads settings & projects) → shell. */
export function App() {
  return (
    <AppThemeProvider>
      <ErrorBoundary area="Inkwell">
        <Bootstrap />
      </ErrorBoundary>
    </AppThemeProvider>
  );
}
