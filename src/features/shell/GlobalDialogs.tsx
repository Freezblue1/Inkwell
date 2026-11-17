import { lazy, Suspense } from 'react';
import { useStore } from '@/store';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const CommandPalette = lazy(() => import('@/features/tools/CommandPalette'));
const GlobalSearch = lazy(() => import('@/features/tools/GlobalSearch'));
const ShortcutsDialog = lazy(() => import('@/features/tools/ShortcutsDialog'));
const NameGenerator = lazy(() => import('@/features/tools/NameGenerator'));
const LookupDialog = lazy(() => import('@/features/tools/LookupDialog'));
const AnalysisDrawer = lazy(() => import('@/features/tools/AnalysisDrawer'));
const AIAssistant = lazy(() => import('@/features/tools/AIAssistant'));
const ProjectPicker = lazy(() => import('@/features/projects/ProjectPicker'));
const CompileDialog = lazy(() => import('@/features/export/CompileDialog'));
const Scratchpad = lazy(() => import('@/features/research/Scratchpad'));
const SettingsDialog = lazy(() => import('./SettingsDialog'));
const BibleEntryDialog = lazy(() => import('@/features/plan/bible/BibleEntryDialog'));
const FootnoteDialog = lazy(() => import('@/features/editor/FootnoteDialog'));
const ImportDialog = lazy(() => import('@/features/import/ImportDialog'));

/** Mounts global dialogs/panels only while they are open (each is code-split). */
export function GlobalDialogs() {
  const d = useStore((s) => s.dialogs);
  const lookupWord = useStore((s) => s.lookupWord);
  const bibleEditId = useStore((s) => s.bibleEditId);
  const footnoteEdit = useStore((s) => s.footnoteEdit);

  return (
    <ErrorBoundary area="Dialog">
      <Suspense fallback={null}>
        {d.palette && <CommandPalette />}
        {d.search && <GlobalSearch />}
        {d.shortcuts && <ShortcutsDialog />}
        {d.nameGen && <NameGenerator />}
        {d.analysis && <AnalysisDrawer />}
        {d.ai && <AIAssistant />}
        {d.projects && <ProjectPicker />}
        {d.compile && <CompileDialog />}
        {d.scratchpad && <Scratchpad />}
        {d.settings && <SettingsDialog />}
        {lookupWord && <LookupDialog />}
        {bibleEditId && <BibleEntryDialog />}
        {footnoteEdit && <FootnoteDialog />}
        {d.import && <ImportDialog />}
      </Suspense>
    </ErrorBoundary>
  );
}
