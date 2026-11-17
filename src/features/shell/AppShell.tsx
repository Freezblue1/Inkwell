import { lazy, Suspense } from 'react';
import { Box } from '@mui/material';
import { useStore } from '@/store';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ViewSkeleton } from '@/components/ViewSkeleton';
import { TopBar } from './TopBar';
import { NavRail } from './NavRail';
import { BottomNav } from './BottomNav';
import { BackgroundTasks } from './BackgroundTasks';
import { GlobalDialogs } from './GlobalDialogs';
import { WriteView } from '@/features/editor/WriteView';
import { FocusMode } from '@/features/editor/focus/FocusMode';
import { useGlobalShortcuts } from '@/features/tools/useGlobalShortcuts';

// Secondary views are code-split so the writing surface loads first.
const PlanView = lazy(() => import('@/features/plan/PlanView'));
const ResearchView = lazy(() => import('@/features/research/ResearchView'));
const GoalsView = lazy(() => import('@/features/goals/GoalsView'));
const ExportView = lazy(() => import('@/features/export/ExportView'));
const HistoryView = lazy(() => import('@/features/history/HistoryView'));

const VIEW_NAMES = { write: 'Write', plan: 'Plan', research: 'Research', goals: 'Goals', export: 'Format & Export', history: 'History' };

/** The application frame: app bar, navigation, current view and global dialogs. */
export function AppShell() {
  const layout = useLayoutMode();
  const view = useStore((s) => s.view);
  const focusMode = useStore((s) => s.focusMode);
  useGlobalShortcuts();

  const content = (() => {
    switch (view) {
      case 'write':
        return <WriteView />;
      case 'plan':
        return <PlanView />;
      case 'research':
        return <ResearchView />;
      case 'goals':
        return <GoalsView />;
      case 'export':
        return <ExportView />;
      case 'history':
        return <HistoryView />;
    }
  })();

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: (t) => (t.inkwell.scene ? 'transparent' : t.palette.background.default) }}>
      <a href="#main-content" className="visually-hidden" onFocus={(e) => e.currentTarget.classList.remove('visually-hidden')} onBlur={(e) => e.currentTarget.classList.add('visually-hidden')}>
        Skip to content
      </a>
      <TopBar />
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {layout !== 'mobile' && <NavRail />}
        <Box
          component="main"
          id="main-content"
          aria-label={VIEW_NAMES[view]}
          tabIndex={-1}
          sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', outline: 'none' }}
        >
          <ErrorBoundary area={VIEW_NAMES[view]} resetKey={view}>
            <Suspense fallback={<ViewSkeleton />}>{content}</Suspense>
          </ErrorBoundary>
        </Box>
      </Box>
      {layout === 'mobile' && <BottomNav />}
      {focusMode && (
        <ErrorBoundary area="Focus mode">
          <FocusMode />
        </ErrorBoundary>
      )}
      <BackgroundTasks />
      <GlobalDialogs />
    </Box>
  );
}
