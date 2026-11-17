import { Box, Tab, Tabs } from '@mui/material';
import { useStore } from '@/store';
import type { PlanTab } from '@/store/uiSlice';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Corkboard } from './corkboard/Corkboard';
import { WhiteboardView } from '@/features/whiteboard/WhiteboardView';
import { Outliner } from './outliner/Outliner';
import { PlotGrid } from './plotgrid/PlotGrid';
import { Timeline } from './timeline/Timeline';
import { StoryBible } from './bible/StoryBible';
import { RelationshipMap } from './relationships/RelationshipMap';
import { StructureTemplates } from './structure/StructureTemplates';

const TABS: { value: PlanTab; label: string }[] = [
  { value: 'corkboard', label: 'Corkboard' },
  { value: 'whiteboard', label: 'Whiteboard' },
  { value: 'outliner', label: 'Outliner' },
  { value: 'plotgrid', label: 'Plot grid' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'bible', label: 'Story Bible' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'structure', label: 'Structure' },
];

/** Plan view: planning tools in tabs. */
export default function PlanView() {
  const tab = useStore((s) => s.planTab);
  const setTab = useStore((s) => s.setPlanTab);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" aria-label="Planning tools" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 1 }}>
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} id={`plan-tab-${t.value}`} aria-controls="plan-panel" />
        ))}
      </Tabs>
      <Box id="plan-panel" role="tabpanel" aria-labelledby={`plan-tab-${tab}`} sx={{ flex: 1, minHeight: 0, overflow: tab === 'whiteboard' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        <ErrorBoundary area={TABS.find((t) => t.value === tab)?.label} resetKey={tab}>
          {tab === 'corkboard' && <Corkboard />}
          {tab === 'whiteboard' && <WhiteboardView />}
          {tab === 'outliner' && <Outliner />}
          {tab === 'plotgrid' && <PlotGrid />}
          {tab === 'timeline' && <Timeline />}
          {tab === 'bible' && <StoryBible />}
          {tab === 'relationships' && <RelationshipMap />}
          {tab === 'structure' && <StructureTemplates />}
        </ErrorBoundary>
      </Box>
    </Box>
  );
}
