import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import HubIcon from '@mui/icons-material/HubOutlined';
import type { Character } from '@/types/models';
import { useStore } from '@/store';
import { forceLayout } from '@/lib/graphLayout';
import { EmptyState } from '@/components/EmptyState';
import { DOC_COLORS } from '@/features/binder/docIcons';

const W = 960;
const H = 600;

/** Graph of character relationships. Drag nodes to rearrange; click to open. */
export function RelationshipMap() {
  const bible = useStore((s) => s.bible);
  const theme = useTheme();
  const characters = useMemo(() => bible.filter((b): b is Character => b.kind === 'character'), [bible]);
  const edges = useMemo(
    () =>
      characters.flatMap((c) =>
        c.relationships.filter((r) => characters.some((o) => o.id === r.targetId)).map((r) => ({ source: c.id, target: r.targetId, label: r.type })),
      ),
    [characters],
  );
  const [seed, setSeed] = useState(0);
  // `seed` forces a fresh layout when the user clicks Re-layout.
  const layout = useMemo(() => (seed >= 0 ? forceLayout(characters.map((c) => c.id), edges, W, H) : new Map()), [characters, edges, seed]);
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const pos = (id: string) => overrides[id] ?? layout.get(id) ?? { x: W / 2, y: H / 2 };

  const toSvg = (e: PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  if (characters.length === 0) {
    return (
      <EmptyState
        icon={<HubIcon />}
        title="No characters yet"
        description="Add characters and their relationships in the Story Bible to see the web of your cast."
        action={<Button onClick={() => useStore.getState().setPlanTab('bible')}>Open Story Bible</Button>}
      />
    );
  }

  const fg = theme.palette.text.primary;
  const muted = theme.palette.text.secondary;

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" component="h2">
            Relationship map
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {characters.length} characters · {edges.length} relationships. Drag to arrange, click to edit.
          </Typography>
        </Box>
        <Button
          onClick={() => {
            setOverrides({});
            setSeed((s) => s + 1);
          }}
        >
          Re-layout
        </Button>
      </Stack>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Relationship map: ${edges.map((e) => `${characters.find((c) => c.id === e.source)?.name} ${e.label || 'related to'} ${characters.find((c) => c.id === e.target)?.name}`).join('; ')}`}
          style={{ display: 'block', touchAction: 'none', maxHeight: '70vh' }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            drag.current.moved = true;
            const p = toSvg(e);
            setOverrides((o) => ({ ...o, [drag.current!.id]: p }));
          }}
          onPointerUp={() => {
            justDragged.current = drag.current?.moved ?? false;
            drag.current = null;
          }}
          onPointerLeave={() => (drag.current = null)}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="30" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={muted} />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const a = pos(e.source);
            const b = pos(e.target);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={muted} strokeOpacity={0.5} strokeWidth={1.5} markerEnd="url(#arrow)" />
                {e.label && (
                  <text x={mx} y={my - 6} textAnchor="middle" fontSize={12} fill={muted} style={{ paintOrder: 'stroke', stroke: theme.palette.background.paper, strokeWidth: 4 }}>
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
          {characters.map((c, i) => {
            const p = pos(c.id);
            const color = c.color || DOC_COLORS[i % DOC_COLORS.length];
            return (
              <g
                key={c.id}
                transform={`translate(${p.x}, ${p.y})`}
                style={{ cursor: 'grab' }}
                tabIndex={0}
                role="button"
                aria-label={`${c.name}${c.role ? `, ${c.role}` : ''}`}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  drag.current = { id: c.id, moved: false };
                }}
                onClick={() => {
                  if (!justDragged.current) useStore.getState().openBibleEntry(c.id);
                  justDragged.current = false;
                }}
                onKeyDown={(e) => e.key === 'Enter' && useStore.getState().openBibleEntry(c.id)}
              >
                <circle r={24} fill={color} stroke={theme.palette.background.paper} strokeWidth={3} />
                <text textAnchor="middle" dy={6} fontSize={18} fontWeight={600} fill="#fff">
                  {c.name.charAt(0)}
                </text>
                <text textAnchor="middle" y={42} fontSize={13} fontWeight={500} fill={fg} style={{ paintOrder: 'stroke', stroke: theme.palette.background.paper, strokeWidth: 4 }}>
                  {c.name}
                </text>
                {c.role && (
                  <text textAnchor="middle" y={58} fontSize={11} fill={muted}>
                    {c.role}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
