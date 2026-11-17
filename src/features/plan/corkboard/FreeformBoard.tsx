import { useMemo } from 'react';
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { InkDocument } from '@/types/models';
import { useStore } from '@/store';
import { IndexCard } from './IndexCard';

const CARD_W = 230;
const CARD_H = 172;
const GAP = 24;

function defaultPos(i: number) {
  const perRow = 5;
  return { x: GAP + (i % perRow) * (CARD_W + GAP), y: GAP + Math.floor(i / perRow) * (CARD_H + GAP) };
}

function FreeCard({ doc, x, y }: { doc: InkDocument; x: number; y: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      sx={{ position: 'absolute', left: x, top: y, width: CARD_W, zIndex: isDragging ? 10 : 1, touchAction: 'none' }}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <IndexCard doc={doc} dragging={isDragging} />
    </Box>
  );
}

/** Freeform corkboard: cards can be placed anywhere; positions are saved per card. */
export function FreeformBoard({ cards }: { cards: InkDocument[] }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const positions = useMemo(() => cards.map((c, i) => ({ doc: c, ...(c.metadata.corkPos ?? defaultPos(i)) })), [cards]);
  const width = Math.max(1200, ...positions.map((p) => p.x + CARD_W + GAP));
  const height = Math.max(600, ...positions.map((p) => p.y + CARD_H + GAP));

  const onDragEnd = (e: DragEndEvent) => {
    const p = positions.find((x) => x.doc.id === e.active.id);
    if (!p) return;
    const x = Math.max(0, Math.round((p.x + e.delta.x) / 8) * 8);
    const y = Math.max(0, Math.round((p.y + e.delta.y) / 8) * 8);
    void useStore.getState().updateDocMeta(p.doc.id, { corkPos: { x, y } });
  };

  const tidy = () => {
    const s = useStore.getState();
    cards.forEach((c, i) => void s.updateDocMeta(c.id, { corkPos: defaultPos(i) }));
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Arrange cards freely — cluster ideas, map subplots, build a wall of scenes. Positions are remembered.
        </Typography>
        <Button size="small" onClick={tidy}>
          Tidy into grid
        </Button>
      </Stack>
      <Box
        sx={(t) => ({
          position: 'relative',
          overflow: 'auto',
          height: '70vh',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: t.palette.mode === 'dark' ? '#2a2119' : '#c9a77c',
          backgroundImage: `radial-gradient(${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'} 1px, transparent 1px)`,
          backgroundSize: '12px 12px',
        })}
        aria-label="Freeform corkboard"
      >
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <Box sx={{ position: 'relative', width, height }}>
            {positions.map((p) => (
              <FreeCard key={p.doc.id} doc={p.doc} x={p.x} y={p.y} />
            ))}
          </Box>
        </DndContext>
      </Box>
    </Box>
  );
}
