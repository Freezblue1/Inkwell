import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import type { ID, InkDocument } from '@/types/models';
import { useStore } from '@/store';
import { aggregateWordCounts, childrenOf, nearestAncestorOfType, sceneSequence } from '@/lib/tree';
import { EmptyState } from '@/components/EmptyState';
import { IndexCard } from './IndexCard';
import { FreeformBoard } from './FreeformBoard';

type GroupBy = 'chapter' | 'part' | 'none';

interface Group {
  id: string;
  title: string;
  container: InkDocument | null;
  cards: InkDocument[];
}

function SortableCard({ doc }: { doc: InkDocument }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: doc.id });
  return (
    <Box ref={setNodeRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}>
      <IndexCard doc={doc} />
    </Box>
  );
}

/** Corkboard of scene cards, grouped by chapter or part, with a freeform mode. */
export function Corkboard() {
  const docs = useStore((s) => s.docs);
  const [groupBy, setGroupBy] = useState<GroupBy>('chapter');
  const [mode, setMode] = useState<'grid' | 'freeform'>('grid');
  const [activeId, setActiveId] = useState<ID | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const groups: Group[] = useMemo(() => {
    const cards = sceneSequence(docs);
    if (groupBy === 'none') return [{ id: 'all', title: 'All scenes', container: null, cards }];
    const map = new Map<string, Group>();
    for (const c of cards) {
      const container = groupBy === 'chapter' ? (c.type === 'chapter' ? (c.parentId ? docs[c.parentId] : null) : c.parentId ? docs[c.parentId] : null) : nearestAncestorOfType(docs, c.id, 'part');
      const key = container?.id ?? 'root';
      if (!map.has(key)) map.set(key, { id: key, title: container?.title ?? 'Ungrouped', container: container ?? null, cards: [] });
      map.get(key)!.cards.push(c);
    }
    return [...map.values()];
  }, [docs, groupBy]);

  const totals = aggregateWordCounts(docs);
  const active = activeId ? docs[activeId] : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || e.active.id === e.over.id) return;
    const s = useStore.getState();
    const target = s.docs[String(e.over.id)];
    const moving = s.docs[String(e.active.id)];
    if (!target || !moving) return;
    const siblings = childrenOf(s.docs, target.parentId).filter((d) => d.id !== moving.id);
    let index = siblings.findIndex((d) => d.id === target.id);
    // Dropping onto a later card in the same parent places it after that card.
    const original = childrenOf(s.docs, target.parentId);
    if (moving.parentId === target.parentId && original.findIndex((d) => d.id === moving.id) < original.findIndex((d) => d.id === target.id)) index += 1;
    void s.moveDoc(moving.id, target.parentId, index);
  };

  const addCard = async (container: InkDocument | null) => {
    const s = useStore.getState();
    const parent = container && container.type === 'part' ? childrenOf(s.docs, container.id).filter((d) => d.type === 'chapter').pop() ?? container : container;
    await s.createDoc({ type: 'scene', parentId: parent?.id ?? null, status: 'Idea' });
  };

  const totalCards = groups.reduce((n, g) => n + g.cards.length, 0);

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2" sx={{ flex: 1 }}>
          Corkboard
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)} aria-label="Corkboard mode">
          <ToggleButton value="grid">Grid</ToggleButton>
          <ToggleButton value="freeform">Freeform</ToggleButton>
        </ToggleButtonGroup>
        {mode === 'grid' && (
          <ToggleButtonGroup size="small" exclusive value={groupBy} onChange={(_, v) => v && setGroupBy(v)} aria-label="Group cards by">
            <ToggleButton value="chapter">By chapter</ToggleButton>
            <ToggleButton value="part">By part</ToggleButton>
            <ToggleButton value="none">Flat</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      {totalCards === 0 ? (
        <EmptyState
          icon={<DashboardIcon />}
          title="Your corkboard is empty"
          description="Cards are the scenes of your manuscript. Add one here, or generate a starter outline from Structure."
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => void addCard(null)}>
              Add a card
            </Button>
          }
        />
      ) : mode === 'freeform' ? (
        <FreeformBoard cards={groups.flatMap((g) => g.cards)} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <Stack spacing={4}>
            {groups.map((g) => (
              <Box key={g.id} component="section" aria-label={g.title}>
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.5 }}>
                  <Typography variant="h6" component="h3">
                    {g.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {g.cards.length} cards · {(g.container ? totals.get(g.container.id) ?? 0 : g.cards.reduce((n, c) => n + c.wordCount, 0)).toLocaleString()} words
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" startIcon={<AddIcon />} onClick={() => void addCard(g.container)}>
                    Card
                  </Button>
                </Stack>
                <SortableContext items={g.cards.map((c) => c.id)} strategy={rectSortingStrategy}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
                    {g.cards.map((c) => (
                      <SortableCard key={c.id} doc={c} />
                    ))}
                  </Box>
                </SortableContext>
              </Box>
            ))}
          </Stack>
          <DragOverlay>{active ? <IndexCard doc={active} width={240} dragging /> : null}</DragOverlay>
        </DndContext>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
        Drag cards to reorder (across groups too). Click a synopsis to edit it; double-click a card to open the scene.
      </Typography>
    </Box>
  );
}
